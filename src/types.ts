export type Period = {
  open: { day: number; time: string };
  close: { day: number; time: string };
};

export type OpeningHours = {
  periods?: Period[];
  open_now?: boolean;
  [k: string]: any;
};

export type PlaceDetails = {
  result: {
    opening_hours?: OpeningHours;
    [k: string]: any;
  };
  [k: string]: any;
};
