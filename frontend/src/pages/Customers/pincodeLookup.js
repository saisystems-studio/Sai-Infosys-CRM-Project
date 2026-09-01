export const mapPincodeResponse = (data) => {
  if (!Array.isArray(data) || data.length === 0) return null;

  const payload = data[0];
  const offices = Array.isArray(payload?.PostOffice) ? payload.PostOffice : [];
  const office = offices[0];

  if (!office) return null;

  const city = office.District || office.City || office.Name || "";
  const state = office.State || "";

  if (!city || !state) return null;

  return {
    city,
    state,
    country: "India",
  };
};
