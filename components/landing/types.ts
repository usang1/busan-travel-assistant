export type LandingFact = {
  key: "menu" | "price" | "hours" | "waiting" | "solo" | "transit";
  label: string;
  value: string;
};

export type LandingPlace = {
  id: string;
  slug: string;
  name: string;
  secondaryName: string;
  category: string;
  address: string;
  imageUrl: string;
  latitude: number | null;
  longitude: number | null;
  facts: LandingFact[];
  verified: boolean;
};
