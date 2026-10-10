// "One thing to do outside today", picked by days remaining. Curated by hand, never generated.
const PREP: { minDays: number; items: string[] }[] = [
  {
    minDays: 45,
    items: [
      "Walk 5 km at a brisk pace in the nearest park, without stopping.",
      "Take the stairs everywhere today, and climb ten flights in one go at least once.",
      "Find a hill, a flyover ramp or a stadium's stands and walk up and down it for 30 minutes.",
    ],
  },
  {
    minDays: 21,
    items: [
      "Walk 8 km today with a day pack carrying 4 to 5 kg.",
      "Wear the boots you'll trek in for a 6 km walk, and note any spot that rubs.",
      "Do a slow hour-long walk on uneven ground: a park trail, a riverbank, a rocky patch.",
    ],
  },
  {
    minDays: 7,
    items: [
      "Walk 10 km with your full day pack and the water you'll carry on the trek.",
      "Break in your socks and boots together on a 5 km walk, then check your feet.",
      "Walk at an easy pace for 90 minutes and practise breathing through your nose.",
    ],
  },
  {
    minDays: 2,
    items: [
      "Take an easy 3 km walk to stay loose. Nothing hard this close to the trek.",
      "Walk to buy anything still missing from your kit list, instead of ordering it.",
    ],
  },
  {
    minDays: 0,
    items: ["Go for a short walk, pack your bag outside in daylight, and sleep early."],
  },
];

export function prepFor(daysToGo: number): string {
  const band = PREP.find((b) => daysToGo >= b.minDays) ?? PREP[PREP.length - 1]!;
  return band.items[Math.abs(daysToGo) % band.items.length]!;
}
