import avatarDefault from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarOne from "@/public/images/avatar/one.png";
import avatarSix from "@/public/images/avatar/six.png";
import avatarThree from "@/public/images/avatar/three.png";
import avatarTwo from "@/public/images/avatar/two.png";
import Image from "next/image";
import Link from "next/link";

const Brackets = () => {
  return (
    <div className="tournament-tab__single" id="tournamentBrackets">
      <div className="common-space tournament-bracket">
        <div className="row mb-40 d-none d-lg-flex">
          <div className="col-12 col-lg-4">
            <h6 className="fw-6 mt-8 ">Single Elimination-R2</h6>
          </div>
          <div className="col-12 col-lg-4">
            <h6 className="fw-6 mt-8">Single Elimination-R3</h6>
          </div>
          <div className="col-12 col-lg-4">
            <h6 className="fw-6 mt-8">Final</h6>
          </div>
        </div>
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-lg-4">
            <div className="tournament-bracket__wrap">
              <h6 className="fw-6 mt-8 d-block d-lg-none">Single Elimination-R2</h6>
              <div className="tournament-bracket__inner">
                <div className="tournament-bracket__group-wrapper tournament-bracket-first">
                  <div className="tournament-bracket__group">
                    <div className="tournament-bracket__single">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarOne} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Arlene McCoy</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                    <div className="tournament-bracket__single mt-12">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarTwo} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Jacob Jones</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                  </div>
                  <div className="tournament-bracket__group">
                    <div className="tournament-bracket__single">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarThree} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Eleanor Pena</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                    <div className="tournament-bracket__single mt-12">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarFour} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Ronald Richards</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tournament-bracket__group-wrapper tournament-bracket-first">
                  <div className="tournament-bracket__group">
                    <div className="tournament-bracket__single">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarFive} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Dianne Russell</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                    <div className="tournament-bracket__single mt-12">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarDefault} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Jenny Wilson</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                  </div>
                  <div className="tournament-bracket__group">
                    <div className="tournament-bracket__single">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarSix} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Theresa Webb</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                    <div className="tournament-bracket__single mt-12">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarOne} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Guy Hawkins</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="tournament-bracket__wrap">
              <h6 className="fw-6 mt-8 d-block d-lg-none">Single Elimination-R3</h6>
              <div className="tournament-bracket__inner tournament-bracket-second">
                <div className="tournament-bracket__group-wrapper">
                  <div className="tournament-bracket__group">
                    <div className="tournament-bracket__single">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarDefault} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Cody Fisher</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                    <div className="tournament-bracket__single mt-12">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarOne} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Jacob Jones</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tournament-bracket__group-wrapper">
                  <div className="tournament-bracket__group">
                    <div className="tournament-bracket__single">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarTwo} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Arlene McCoy</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                    <div className="tournament-bracket__single mt-12">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarFour} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Robert Fox</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="tournament-bracket__wrap">
              <h6 className="fw-6 mt-8 d-block d-lg-none">Final</h6>
              <div className="tournament-bracket__inner tournament-bracket__final">
                <div className="tournament-bracket__group-wrapper">
                  <div className="tournament-bracket__group tournament-bracket__group-final">
                    <div className="tournament-bracket__single">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarOne} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Arlene McCoy</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
                      </div>
                    </div>
                    <div className="tournament-bracket__single mt-12">
                      <div className="tournament-bracket__team">
                        <Link href="/public-profile" className="hexagon-wrapper">
                          <Image src={avatarTwo} alt="View Profile" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </Link>
                        <Link href="/public-profile">Robert Fox</Link>
                      </div>
                      <div className="tournament-bracket__result">
                        <p className="text-xl">0</p>
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
  );
};

export default Brackets;
