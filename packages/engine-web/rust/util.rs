use hashintel_core::prelude::*;
use js_sys::Error;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::json;
use wasm_bindgen::prelude::*;

#[derive(Debug)]
pub struct JsError(JsValue);
unsafe impl Send for JsError {}
unsafe impl Sync for JsError {}

impl std::fmt::Display for JsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self.0)
    }
}

impl std::error::Error for JsError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}

impl Into<SimulationError> for JsError {
    fn into(self) -> SimulationError {
        SimulationError::Inner(Box::new(self))
    }
}

pub fn err_to_jsvalue<E: Into<SimulationError>>(e: E) -> JsValue {
    use SimulationError::Inner;

    let sim_err = e.into();
    match sim_err {
        Inner(err) => {
            if err.is::<JsError>() {
                err.downcast::<JsError>().unwrap().0
            } else {
                Error::new(&err.to_string()).into()
            }
        }
        _ => Error::new(&sim_err.to_string()).into(),
    }
}

#[must_use]
pub fn jsvalue_to_err(v: JsValue) -> SimulationError {
    JsError(v).into()
}

/// Rust → JS via `serde-wasm-bindgen` (replacement for deprecated `JsValue::from_serde`).
///
/// Stable contract — keep this even when upgrading crates:
/// 1. Domain types first become `serde_json::Value` so custom `Serialize` impls
///    (especially `AgentState`) run the same path as the rest of the engine.
/// 2. JS encoding uses `Serializer::json_compatible()` so we emit plain objects and
///    `null`, matching historical JSON/`from_serde` behaviour.
///
/// Never call bare `serde_wasm_bindgen::to_value`: default mode emits ES `Map` /
/// `undefined` and breaks the simulation UI.
pub fn to_js_value<T: Serialize + ?Sized>(value: &T) -> Result<JsValue, JsValue> {
    let value = serde_json::to_value(value).map_err(|e| err_to_jsvalue(e.to_string()))?;
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|e| err_to_jsvalue(e.to_string()))
}

/// JS → Rust via `serde-wasm-bindgen` (replacement for deprecated `JsValue::into_serde`).
///
/// Stable contract — keep this even when upgrading crates:
/// Decode JS into `serde_json::Value` first, then `serde_json::from_value` into `T`.
/// Direct `from_value::<AgentState>` bypasses / breaks the custom deserializer and
/// drops custom fields (`decidedList`, `allMessages`, … → `null.concat` in behaviors).
pub fn from_js_value<T: DeserializeOwned>(value: &JsValue) -> Result<T, JsValue> {
    let value: serde_json::Value =
        serde_wasm_bindgen::from_value(value.clone()).map_err(|e| err_to_jsvalue(e.to_string()))?;
    serde_json::from_value(value).map_err(|e| err_to_jsvalue(e.to_string()))
}

#[wasm_bindgen]
pub fn list_behaviors() -> Result<JsValue, JsValue> {
    let simple_list: Vec<serde_json::Value> = BUILTIN_BEHAVIORS
        .iter()
        .map(|(_, behavior)| {
            json!({
                "name": behavior.name,
                "dependencies": behavior.dependencies,
            })
        })
        .collect();
    to_js_value(&simple_list)
}
