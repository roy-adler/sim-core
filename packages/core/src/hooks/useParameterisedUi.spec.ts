import { getUiQueryParams } from "./useParameterisedUi";

const setSearch = (search: string) => {
  window.history.replaceState({}, "", search ? `?${search}` : "/");
};

describe("getUiQueryParams activity default", () => {
  afterEach(() => {
    setSearch("");
  });

  it("defaults activity to false when param is absent", () => {
    setSearch("");
    expect(getUiQueryParams().activity).toBe(false);
  });

  it("enables activity when activity=true", () => {
    setSearch("activity=true");
    expect(getUiQueryParams().activity).toBe(true);
  });

  it("keeps activity false when activity=false", () => {
    setSearch("activity=false");
    expect(getUiQueryParams().activity).toBe(false);
  });
});
