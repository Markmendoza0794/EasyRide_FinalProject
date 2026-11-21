const calculateDistance = (
  latitude,
  longitude,
  terminalLatitude,
  terminalLongitude
) => {
  const coordinates = [
    latitude,
    longitude,
    terminalLatitude,
    terminalLongitude,
  ];

  if (!coordinates.every(Number.isFinite)) {
    throw new TypeError("Coordinates must be finite numbers.");
  }

  if (
    Math.abs(latitude) > 90 ||
    Math.abs(terminalLatitude) > 90 ||
    Math.abs(longitude) > 180 ||
    Math.abs(terminalLongitude) > 180
  ) {
    throw new RangeError("Coordinates are outside valid ranges.");
  }

  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => degrees * Math.PI / 180;

  const latitudeDifference = toRadians(
    terminalLatitude - latitude
  );

  const longitudeDifference = toRadians(
    terminalLongitude - longitude
  );

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(terminalLatitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const boundedHaversine = Math.min(
    1,
    Math.max(0, haversine)
  );

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(
      Math.sqrt(boundedHaversine),
      Math.sqrt(1 - boundedHaversine)
    )
  );
};

export default calculateDistance;