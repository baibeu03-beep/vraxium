import bannerTwo from "@/public/images/banner/banner-two-thumb.png";
import spin from "@/public/images/banner/spin.png";
import Image from "next/image";
import Link from "next/link";
const Banner = () => {
  return (
    <section className="banner-two pt-120 pb-120">
      <div className="banner__content ">
        <ol className="breadcrumb">
          <li className="breadcrumb-item active">Explore</li>
          <li className="breadcrumb-item active">Play</li>
          <li className="breadcrumb-item active">Win</li>
        </ol>
        <h1 className="title-animation title-xxl stroked-text fw-8 transform-none mt-8">Play & Earn</h1>
        <p className="text-xl mt-6">Elevate Your Gaming Experience with our NFTG and Level Up Nexus.</p>
        <div className="section__cta mt-40">
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
      <div className="banner-two__thumb">
        <Image src={bannerTwo} alt="Images" />
      </div>
      <div className="spin d-none d-sm-block">
        <Image src={spin} alt="Image" />
      </div>
    </section>
  );
};

export default Banner;
