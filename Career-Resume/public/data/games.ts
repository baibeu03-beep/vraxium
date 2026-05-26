import eight from "@/public/images/games/browse/eight.png";
import eleven from "@/public/images/games/browse/eleven.png";
import fifteen from "@/public/images/games/browse/fifteen.png";
import five from "@/public/images/games/browse/five.png";
import four from "@/public/images/games/browse/four.png";
import fourteen from "@/public/images/games/browse/fourteen.png";
import nine from "@/public/images/games/browse/nine.png";
import seven from "@/public/images/games/browse/seven.png";
import six from "@/public/images/games/browse/six.png";
import ten from "@/public/images/games/browse/ten.png";
import thirteen from "@/public/images/games/browse/thirteen.png";
import three from "@/public/images/games/browse/three.png";
import twelve from "@/public/images/games/browse/twelve.png";
import two from "@/public/images/games/browse/two.png";
import { StaticImageData } from "next/image";
export type Game = {
  id: number;
  title: string;
  tag: string;
  rating: number;
  genres: string[];
  image: StaticImageData;
};
const games = [
  {
    id: 1,
    title: "TronVerse Lite",
    tag: "Alpha",
    rating: 6.7,
    genres: ["Shooter", "Multiplayer"],
    image: two,
  },
  {
    id: 2,
    title: "Apex Legends",
    tag: "Beta",
    rating: 7.5,
    genres: ["Multiplayer", "Strategy"],
    image: three,
  },
  {
    id: 3,
    title: "CS:GO",
    tag: "Beta",
    rating: 3.5,
    genres: ["Adventure", "RPG"],
    image: four,
  },
  {
    id: 4,
    title: "DOTA 2",
    tag: "Alpha",
    rating: 9.5,
    genres: ["Strategy"],
    image: five,
  },
  {
    id: 5,
    title: "Fortnite",
    tag: "Alpha",
    rating: 6.7,
    genres: ["Shooter", "Multiplayer"],
    image: nine,
  },
  {
    id: 6,
    title: "Tank Firing",
    tag: "Beta",
    rating: 7.5,
    genres: ["Multiplayer", "Strategy"],
    image: eight,
  },
  {
    id: 7,
    title: "Rocket League",
    tag: "Beta",
    rating: 3.5,
    genres: ["Adventure", "RPG"],
    image: seven,
  },
  {
    id: 8,
    title: "Show 24",
    tag: "Alpha",
    rating: 9.5,
    genres: ["Strategy"],
    image: six,
  },
  {
    id: 9,
    title: "CS:GO",
    tag: "Beta",
    rating: 3.5,
    genres: ["Adventure", "RPG"],
    image: fifteen,
  },
  {
    id: 10,
    title: "DOTA 2",
    tag: "Alpha",
    rating: 9.5,
    genres: ["Strategy"],
    image: fourteen,
  },
  {
    id: 11,
    title: "Fortnite",
    tag: "Alpha",
    rating: 6.7,
    genres: ["Shooter", "Multiplayer"],
    image: thirteen,
  },
  {
    id: 12,
    title: "Tank Firing",
    tag: "Beta",
    rating: 7.5,
    genres: ["Multiplayer", "Strategy"],
    image: twelve,
  },
  {
    id: 13,
    title: "Rocket League",
    tag: "Beta",
    rating: 3.5,
    genres: ["Adventure", "RPG"],
    image: eleven,
  },
  {
    id: 14,
    title: "Show 24",
    tag: "Alpha",
    rating: 9.5,
    genres: ["Strategy"],
    image: ten,
  },
];

export default games;
