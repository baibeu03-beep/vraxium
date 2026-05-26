import packAvatar from "@/public/images/pack-avatar/one.png";
import packageBanner from "@/public/images/package/package-banner.webp";
import Image from "next/image";
import Link from "next/link";

const Banner = () => {
  return (
    <div className="package-banner">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="package-banner__inner">
              <Image src={packageBanner} alt="Package Banner" className="parallax-image" />
              <Link href="/shop" title="go back" className="btn--primary">
                <i className="ti ti-chevron-left"></i> Back To Packages
              </Link>
              <div className="hexagon-wrapper">
                <Image src={packAvatar} alt="Pack Avatar" />
                <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                  <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Banner;
