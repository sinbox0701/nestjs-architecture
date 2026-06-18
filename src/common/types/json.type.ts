type JSONValue = string | number | boolean | JSONObject | JSONArray | null | undefined;

interface JSONObject {
  [x: string]: JSONValue;
}

type JSONArray = Array<JSONValue>;
