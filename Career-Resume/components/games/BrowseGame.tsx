"use client";
import games from "@/public/data/games";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import NiceSelectComponent from "../shared/NiceSelect";
import RangeSlider from "../shared/RangeSlider";
interface InputOption {
  id: string;
  label: string;
  value: string;
  iconClass?: string;
}
const radioOptions: InputOption[] = [
  { id: "week", label: "Last 7 days", value: "week" },
  { id: "month", label: "Last 30 days", value: "month" },
  { id: "halfYear", label: "Last 6 Months", value: "halfYear" },
  { id: "fullYear", label: "Last 12 Months", value: "fullYear" },
];

const networkOptions: InputOption[] = [
  { id: "polygon", label: "Polygon", value: "polygon", iconClass: "ti ti-link" },
  { id: "solana", label: "Solana", value: "solana", iconClass: "ti ti-menu-deep" },
  { id: "chain", label: "BNB Chain", value: "chain", iconClass: "ti ti-usb" },
  { id: "ethereum", label: "Ethereum", value: "ethereum", iconClass: "ti ti-currency-ethereum" },
  { id: "avalanche", label: "Avalanche", value: "avalanche", iconClass: "ti ti-brand-strava" },
];
const platformOptions: InputOption[] = [
  { id: "windows", label: "Windows", iconClass: "ti ti-brand-windows", value: "windows" },
  { id: "web", label: "Web 54", iconClass: "ti ti-world", value: "web" },
  { id: "android", label: "Android", iconClass: "ti ti-brand-android", value: "android" },
  { id: "mac", label: "Mac OS", iconClass: "ti ti-brand-apple", value: "mac" },
];
const BrowseGame = () => {
  const [date, setDate] = useState(radioOptions[0].value);
  const [checkedNetwork, setCheckedNetwork] = useState<string[]>(["solana"]);
  const [checkedPlatform, setCheckedPlatform] = useState<string[]>(["windows"]);
  const [editorRating, setEditorRating] = useState(5);
  const [userRating, setUserRating] = useState(2);
  const handleCheckedNetwork = (value: string) => {
    setCheckedNetwork((prevChecked) => (prevChecked.includes(value) ? prevChecked.filter((option) => option !== value) : [...prevChecked, value]));
  };
  const handleCheckedPlatform = (value: string) => {
    setCheckedPlatform((prevChecked) => (prevChecked.includes(value) ? prevChecked.filter((option) => option !== value) : [...prevChecked, value]));
  };
  return (
    <section className="browse-game pt-120 pb-120">
      <div className="container-fluid">
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-xl-9">
            <div className="browse-game__content">
              <div className="browse-game__header mb-60">
                <div className="game-heading">
                  <h3 className="fw-6">Browse Games</h3>
                </div>
                <div className="game-filter">
                  <div className="select-shape btn-wrapper">
                    <NiceSelectComponent
                      options={[
                        { value: "newest", text: "Newest" },
                        { value: "oldest", text: "Oldest" },
                      ]}
                      placeholder="Newest"
                      onChange={(selectedValue) => {
                        // Handle the change here
                        console.log("Selected value:", selectedValue);
                      }}
                    />
                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                  <button type="button" aria-label="filter" className="filter-btn">
                    <i className="ti ti-filter"></i>
                  </button>
                </div>
              </div>
              <div className="row vertical-column-gap-md">
                {games.map(({ id, genres, image, rating, tag, title }) => (
                  <div key={id} className="col-12 col-sm-6 col-lg-4 ">
                    <div className="browse-game__single">
                      <div className="thumb-wrapper">
                        <div className="thumb">
                          <Image src={image} alt="Image" />
                        </div>
                        <span className="top-tag">{tag}</span>
                        <div className="footer-tag">
                          <div className="platform">
                            <span className="ti ti-brand-apple"></span>
                            <span className="ti ti-brand-android"></span>
                          </div>
                          <div className="rating">
                            <p>{rating}</p>
                          </div>
                        </div>
                        <Link href={`/games/${id}`}>
                          <i className="ti ti-arrow-up-right"></i>
                        </Link>
                      </div>
                      <div className="content">
                        <h5>
                          <Link href={`/games/${id}`}>{title}</Link>
                        </h5>
                        <p>{genres.map((genre, i) => genre + (i < genres.length - 1 ? ", " : ""))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="row">
                <div className="col-12">
                  <div className="ctatext-center">
                    <div className="pagination-wrapper">
                      <ul className="pagination">
                        <li>
                          <button>
                            <i className="ti ti-chevrons-left"></i>
                          </button>
                        </li>
                        <li>
                          <Link href="/games">1</Link>
                        </li>
                        <li>
                          <Link href="/games" className="active">
                            2
                          </Link>
                        </li>
                        <li>
                          <Link href="/games">3</Link>
                        </li>
                        <li>
                          <button>
                            <i className="ti ti-chevrons-right"></i>
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-3">
            <div className="browse-game__sidebar">
              <div className="browse-sidebar__widget-filter">
                <div className="intro">
                  <h6>
                    <i className="ti ti-filter"></i> Filter
                  </h6>
                  <button className="clear-filter">Clear all</button>
                </div>
                <div className="inner-padding">
                  <form action="#" method="post" autoComplete="off">
                    <div className="search-wrap">
                      <input type="search" name="search-field-games" id="searchFieldGames" placeholder="Search Games" required />
                      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                        <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <button type="submit" aria-label="search games" title="search games">
                        <i className="ti ti-search"></i>
                      </button>
                    </div>
                  </form>
                  <div className="check-group-wrapper mt-24">
                    <div className="check-group">
                      <div className="check-group-single">
                        <i className="ti ti-device-gamepad-2"></i>
                        <p className="text-md">Play Now</p>
                      </div>
                      <label htmlFor="play"></label>
                      <div className="check-mark-wrapper">
                        <input type="checkbox" name="play" id="play" />
                        <span className="checkmark"></span>
                      </div>
                    </div>
                    <div className="check-group mt-16">
                      <div className="check-group-single">
                        <i className="ti ti-device-gamepad"></i>
                        <p className="text-md">Free To Play</p>
                      </div>
                      <label htmlFor="free"></label>
                      <div className="check-mark-wrapper">
                        <input type="checkbox" name="free" id="free" checked={true} />
                        <span className="checkmark"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="browse-sidebar__widget mt-60">
                <div className="browse-header">
                  <h5>Platforms</h5>
                </div>
                <div className="inner-padding">
                  <div className="check-group-wrapper check-group-alter mt-16">
                    {platformOptions.map((option) => (
                      <div key={option.id} className={`check-group ${checkedPlatform.includes(option.id) ? "checked" : ""} mt-16`}>
                        <div className="check-group-single">
                          <i className={option.iconClass}></i>
                          <p className="text-md">{option.label}</p>
                        </div>
                        <label htmlFor={option.id}></label>
                        <div className="check-mark-wrapper">
                          <input type="checkbox" name={option.id} id={option.id} checked={checkedPlatform.includes(option.id)} onChange={() => handleCheckedPlatform(option.id)} />
                          <span className="checkmark"></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="browse-sidebar__widget mt-60">
                <div className="browse-header">
                  <h5>Ratings</h5>
                </div>
                <div className="inner-padding">
                  <div className="rating-single">
                    <p>Editor&apos;s Rating</p>
                    <div className="rating-group align-items-end mt-20">
                      <div className="rating-slide">
                        <RangeSlider setValue={setEditorRating} max={10} value={editorRating} />
                      </div>
                      <div className="rating-value-wrapper">
                        <p className="rating-value">{editorRating}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rating-single mt-16">
                    <p>User Ranting</p>
                    <div className="rating-group mt-20 align-items-end">
                      <div className="rating-slide">
                        <RangeSlider setValue={setUserRating} max={10} value={userRating} />
                      </div>
                      <div className="rating-value-wrapper">
                        <p className="user-rating-value">{userRating}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="browse-sidebar__widget mt-60">
                <div className="browse-header">
                  <h5>Networks</h5>
                </div>
                <div className="inner-padding">
                  <div className="check-group-wrapper check-group-alter mt-16">
                    {networkOptions.map((option) => (
                      <div key={option.id} className={`check-group ${checkedNetwork.includes(option.value) ? "checked" : ""} mt-16`}>
                        <div className="check-group-single">
                          <i className={option.iconClass}></i>
                          <p className="text-md">{option.label}</p>
                        </div>
                        <label htmlFor={option.id}></label>
                        <div className="check-mark-wrapper">
                          <input type="checkbox" name={option.value} id={option.id} checked={checkedNetwork.includes(option.value)} onChange={() => handleCheckedNetwork(option.value)} />
                          <span className="checkmark"></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="browse-sidebar__widget mt-60">
                <div className="browse-header">
                  <h5>Genres</h5>
                </div>
                <div className="inner-padding">
                  <div className="check-group-wrapper mt-16">
                    <div className="check-group">
                      <div className="check-group-single">
                        <p className="text-md">Multiplayer 97</p>
                      </div>
                      <label htmlFor="multi"></label>
                      <div className="check-mark-wrapper">
                        <input type="checkbox" name="multi" id="multi" />
                        <span className="checkmark"></span>
                      </div>
                    </div>
                    <div className="check-group mt-16">
                      <div className="check-group-single">
                        <p className="text-md">Adventure 54</p>
                      </div>
                      <label htmlFor="adventure"></label>
                      <div className="check-mark-wrapper">
                        <input type="checkbox" name="adventure" id="adventure" />
                        <span className="checkmark"></span>
                      </div>
                    </div>
                    <div className="check-group mt-16">
                      <div className="check-group-single">
                        <p className="text-md">RPG 32</p>
                      </div>
                      <label htmlFor="rpg"></label>
                      <div className="check-mark-wrapper">
                        <input type="checkbox" name="rpg" id="rpg" />
                        <span className="checkmark"></span>
                      </div>
                    </div>
                    <div className="check-group mt-16">
                      <div className="check-group-single">
                        <p className="text-md">Strategy 48</p>
                      </div>
                      <label htmlFor="strategy"></label>
                      <div className="check-mark-wrapper">
                        <input type="checkbox" name="strategy" id="strategy" />
                        <span className="checkmark"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="browse-sidebar__widget mt-60">
                <div className="browse-header">
                  <h5>Date Added</h5>
                </div>
                <div className="inner-padding">
                  <div className="check-group-wrapper check-group-alter mt-16">
                    {radioOptions.map((option) => (
                      <div key={option.id} className={`check-group ${date === option.value ? "checked" : ""} mt-16`}>
                        <div className="check-group-single">
                          <i className="ti ti-calendar-time"></i>
                          <p className="text-md">{option.label}</p>
                        </div>
                        <label htmlFor={option.id}></label>
                        <div className="check-mark-wrapper">
                          <input type="radio" name="date_added" id={option.id} value={option.value} checked={date === option.value} onChange={() => setDate(option.value)} />
                          <span className="checkmark"></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrowseGame;
