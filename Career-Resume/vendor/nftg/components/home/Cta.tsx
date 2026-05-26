import cta from "@/public/images/cta/cta-bg.webp";
import ctaThumb from "@/public/images/cta/cta-thumb.webp";
import Image from "next/image";
import Link from "next/link";
const Cta = () => {
  return (
    <section className="cta mb-120 fade-wrapper">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="cta__inner fade-top">
              <div className="row">
                <div className="col-12">
                  <div className="cta__content">
                    <h2 className="fw-6 text-capitalize title-animation mt-8">Ready to start your journey?</h2>
                    <p className="text-xl mt-24">Don&apos;t just get the game. Get more from your game. Unlock exclusive rewards, members-only content from your game and a library of top titles.</p>
                    <div className="section__cta mt-50">
                      <div className="btn-wrapper">
                        <Link href="/games" className="btn--secondary">
                          Play Now{" "}
                        </Link>
                        <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                          <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="cta__bg">
                <Image src={cta} alt="Image" className="parallax-image" />
              </div>
              <div className="cta-stroke">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                  <path d="M0 0 L95 0 L100 20 L100 100 L5 100 L0 80 L0 0 Z" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="cta__thumb fade-left">
        <Image src={ctaThumb} alt="Image" />
      </div>
    </section>
  );
};

export default Cta;
