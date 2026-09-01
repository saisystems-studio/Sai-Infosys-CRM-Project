import test from "node:test";
import assert from "node:assert/strict";

import { mapPincodeResponse } from "./pincodeLookup.js";

test("maps the first Indian post office result to city state and country", () => {
  const data = [
    {
      Status: "Success",
      PostOffice: [
        {
          Name: "Koramangala",
          District: "Bengaluru Urban",
          State: "Karnataka",
        },
      ],
    },
  ];

  assert.deepEqual(mapPincodeResponse(data), {
    city: "Bengaluru Urban",
    state: "Karnataka",
    country: "India",
  });
});

test("ignores invalid or empty postal responses", () => {
  assert.deepEqual(mapPincodeResponse([]), null);
  assert.deepEqual(mapPincodeResponse([{ Status: "Error" }]), null);
});
