export function isSocialDiscoveryEnabled() {
  return process.env.SOCIAL_DISCOVERY_ENABLED === "true";
}

export function isGroundedTripPlannerEnabled() {
  return process.env.GROUNDED_TRIP_PLANNER_ENABLED === "true";
}

export function isItineraryRecoveryEnabled() {
  return process.env.ITINERARY_RECOVERY_ENABLED === "true";
}

