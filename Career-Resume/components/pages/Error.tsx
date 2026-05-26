import errorThumb from "@/public/images/error/error-thumb.png";
import error from "@/public/images/error/error.png";
import logo from "@/public/images/logo-alt.png";
import Image from "next/image";
import Link from "next/link";
const Error = () => {
  return (
    <div className="nftg-app-alt a-cursor sidebar-add">
      <div className="nftg-thumb">
        <Image src={errorThumb} alt="Page Not Found" className="parallax-image" />
      </div>
      {/* <!-- ==== / thumb end ==== --> */}

      <div className="nftg-layout-two">
        {/* <!-- ==== header start ==== --> */}
        <header className="header-two">
          <div className="container-fluid">
            <div className="row">
              <div className="col-12">
                <div className="navbar p-0">
                  <Link href="/" aria-label="home page" title="logo" className="not-cursor">
                    <Image src={logo} alt="Image" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* <!-- ==== main content start ==== --> */}
        <main className="nftg-content-two">
          <section className="error pt-120 pb-120 fade-wrapper">
            <div className="container-fluid">
              <div className="row justify-content-center">
                <div className="col-12">
                  <div className="error__inner">
                    <div className="error__thumb text-center fade-top mb-60">
                      <Image src={error} alt="Error" />
                    </div>
                    <div className="error__content text-center">
                      <h2 className="fw-6 title-animation mt-8">Oops! Page Not Found</h2>
                      <p className="text-lg mt-24">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                      <div className="error__cta mt-40">
                        <div className="btn-wrapper">
                          <Link href="/" className="btn--secondary">
                            Back To Home{" "}
                          </Link>
                          <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                            <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Error;
