import Image from "next/image";
import Link from "next/link";

import ProfileDropdown from "@/components/shared/ProfileDropdown";
import Social from "@/components/shared/Social";
import avatarAvatar from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarOne from "@/public/images/avatar/one.png";
import gameBrowseEight from "@/public/images/games/browse/eight.png";
import gameBrowseNine from "@/public/images/games/browse/nine.png";
import gameBrowseTen from "@/public/images/games/browse/ten.png";

const Overview = () => {
  return (
    <>
      <div className="tournament-tab__single tournament-overview" id="tournamentOverview">
        <div className="row vertical-column-gap">
          <div className="col-12 col-lg-8">
            <div className="tournament-overview__content">
              <div className="overview-header common-space fade-top">
                <div className="overview-header__single">
                  <Link href="/games/2" aria-label="latest games" title="view game details">
                    <Image src={avatarFive} alt="Image" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </Link>
                </div>
                <div className="overview-header__single">
                  <p className="text-alter">Game</p>
                  <p className="text-xxl fw-6 mt-6">UNO</p>
                </div>
                <div className="overview-header__single">
                  <p className="text-alter">Game Mode</p>
                  <p className="text-xxl fw-6 mt-6">Solos</p>
                </div>
              </div>
              <div className="overview__content common-space mt-24 fade-top">
                <div className="overview__content-group">
                  <h5 className="fw-6">Tournament Info</h5>
                  <p className="text-lg mt-16">Our tournaments require four teams to start, to ensure you get the best competitive experience. A tournament containing less than the mentioned amount will automatically be cancelled, and any entry fee will be refunded through our customer support.</p>
                </div>
                <div className="overview__content-group mt-40">
                  <h6 className="fw-6">Tournament Rules</h6>
                  <ul className="mt-16">
                    <li className="mt-12">After entering the application, you must go to and add the opponent via ID. Example: 31934451337</li>
                    <li className="mt-12">All Rounds: Team has to win 2 rounds to Win; Finals: Team has to win 3 Rounds to Win.</li>
                    <li className="mt-12">Players must provide their ID in the Discord Uno IDs tab so players can communicate together and with the organizer when needed</li>
                    <li className="mt-12">Players communicate in Discord Only</li>
                  </ul>
                </div>
                <div className="overview__content-group mt-40">
                  <h6 className="fw-6">Join the Game</h6>
                  <ul className="mt-16">
                    <li className="mt-12">Check-in opens 60 minutes before the tournament starts.</li>
                    <li className="mt-12">After that, players have 45 minutes to confirm their participation.</li>
                    <li className="mt-12">The team responsible for creating the in-game lobby choose sides.</li>
                    <li className="mt-12">Players will be instructed as to which player has been selected to create the in-game lobby, along with who must be invited from the opposite team. Work together to help everyone get in.</li>
                    <li className="mt-12">Players have 5 minutes to join the pre-game lobby on the Epulze platform. Once matched with opponents, players have 10 minutes to create or join the in-game lobby.</li>
                  </ul>
                </div>
                <div className="overview__content-group mt-40">
                  <h6 className="fw-6">Feedback</h6>
                  <p className="text-lg mt-16">Please tell us about your experience, and make sure you report any bugs to Support.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="tournament-overview__sidebar">
              <div className="common-space tournament-sidebar__header fade-top">
                <div className="tournament-sidebar__left">
                  <p className="text-alter">Organized by</p>
                  <p className="text-xxl fw-5 mt-10">Hala Yalla</p>
                </div>
                <div className="tournament-sidebar__right">
                  <Social />
                </div>
              </div>
              <div className="common-space mt-24 tournament-sidebar__boost fade-top">
                <div className="boost-content">
                  <h5 className="fw-5">
                    <span className="ti ti-highlight"></span> Boost The Prize Pool
                  </h5>
                  <p className="mt-16">Boost and increase the prize pool by any amount. The boosted prize pool can only be won by the highest ranking booster.</p>
                  <Link href="/faq" aria-label="learn more">
                    Learn More
                  </Link>
                </div>
                <div className="boost-form mt-40">
                  <form action="#" method="post">
                    <div className="input-single">
                      <input type="number" name="boost-amount" id="boostAmount" placeholder="Enter Amount" />
                    </div>
                    <button type="submit" className="btn--secondary" aria-label="boost now">
                      Boost Now
                    </button>
                  </form>
                </div>
              </div>
              <div className="common-space tournament-sidebar__admin mt-24 fade-top">
                <h5 className="fw-6 mt-8">Admins (02)</h5>
                <div className="tournament-admin__single mt-20">
                  <div className="admin__sidebar-header">
                    <div className="admin__header-profile">
                      <div className="hexagon-wrapper">
                        <Image src={avatarAvatar} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="admin-info">
                        <p className="text-xl fw-6">
                          <Link href="/public-profile">David Malan</Link>
                        </p>
                        <p className="text-sm text-alter mt-6">OLT SUPPORT</p>
                      </div>
                    </div>
                    <ProfileDropdown />
                  </div>
                </div>
                <div className="tournament-admin__single mt-30">
                  <div className="admin__sidebar-header">
                    <div className="admin__header-profile">
                      <div className="hexagon-wrapper">
                        <Image src={avatarOne} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="admin-info">
                        <p className="text-xl fw-6">
                          <Link href="/public-profile">Rolex Foxy</Link>
                        </p>
                        <p className="text-sm text-alter mt-6">OLT SUPPORT</p>
                      </div>
                    </div>
                    <ProfileDropdown />
                  </div>
                </div>
              </div>
              <div className="common-space mt-24 fade-top">
                <h5 className="fw-6 mt-8">Games</h5>
                <div className="tournament-slider-wrapper mt-20">
                  <div className="tournament-game-slider swiper">
                    <div className="swiper-wrapper">
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/2">
                            <Image src={gameBrowseEight} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/2">
                            <Image src={gameBrowseNine} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/2">
                            <Image src={gameBrowseTen} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/2">
                            <Image src={gameBrowseEight} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/2">
                            <Image src={gameBrowseNine} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/2">
                            <Image src={gameBrowseTen} alt="Image" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Overview;
