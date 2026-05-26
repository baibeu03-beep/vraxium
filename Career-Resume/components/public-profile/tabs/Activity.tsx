import NiceSelectComponent from "@/components/shared/NiceSelect";
import activityImage from "@/public/images/activity.png";
import Image from "next/image";

const Activity = () => {
  return (
    <div className="profile-tab-single" id="profileActivity">
      <div className="profile-tab-filter">
        <div className="profile-tab-filter__inner">
          <div className="profile-tab-filter__single">
            <h6>
              <i className="ti ti-filter"></i> Filter
            </h6>
          </div>
          <div className="profile-tab-group">
            <form action="#" method="post" autoComplete="off">
              <div className="search-wrap">
                <input type="search" name="profile-field-nft-two" id="profileFieldnftTwo" placeholder="Search" required />
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                  <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vector-effect="non-scaling-stroke" />
                </svg>
                <button type="submit" aria-label="search nft" title="search nft">
                  <i className="ti ti-search"></i>
                </button>
              </div>
            </form>
            <div className="game-filter">
              <div className="select-shape btn-wrapper">
                <NiceSelectComponent
                  options={[
                    { value: "newest", text: "Newest" },
                    { value: "oldest", text: "Oldest" },
                  ]}
                  onChange={(item) => {
                    // Handle the change event
                    console.log("Selected:", item);
                  }}
                />
                <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                  <path d="M0 1  L100 1  L100 75 L85 101 L0 101 Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="activity-wrapper mt-120">
        <div className="activity-inner text-center pt-120 pb-120">
          <Image src={activityImage} alt="Image" />
          <p className="text-xl fw-6 text-alter mt-35">Currently There are no activities</p>
        </div>
      </div>
    </div>
  );
};

export default Activity;
