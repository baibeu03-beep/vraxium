import Social from "@/components/shared/Social";
import refer from "@/public/images/refer.png";
import Image from "next/image";
const Refer = () => {
  return (
    <div className="private-item__single private-refer private-withdraw" id="referEarn">
      <div className="row">
        <div className="col-12 col-xl-9">
          <div className="private-content">
            <div className="refer-group">
              <p className="text-alter">Refer a friend</p>
              <div className="refer-group-inner mt-12">
                <div className="refer-thumb">
                  <Image src={refer} alt="Image" />
                </div>
                <div className="refer-content">
                  <h6 className="fw-6">
                    REFER A FRIEND AND GET
                    <span className="quaternary-text">107,450</span> USD
                    <span className="primary-text">+ 25%</span>
                    COMMISSION
                  </h6>
                </div>
              </div>
              <div className="deposit-address__content mt-30">
                <div className="deposit-content-group">
                  <p className="text-alter">Share your referral link:</p>
                  <div className="deposit-address-inner mt-12">
                    <p className="text-sm fw-5">
                      <span className="quaternary-text">GDS4</span>HKW74QFQ2JEFTT5W5OXQBEPP3C6I6VNZSMSVSKI7DXYS332<span className="quaternary-text">U5H2W</span>
                    </p>
                    <span className="copy-btn text-sm">COPY</span>
                  </div>
                </div>
                <div className="deposit-content-group mt-30">
                  <p className="text-alter">Invite With Mail</p>
                  <div className="deposit-address-inner mt-12">
                    <form action="#" method="post">
                      <div className="input-wrapper">
                        <input type="email" name="refer-email" id="referEmail" required placeholder="example@gmail.com" />
                        <button type="submit" aria-label="invite" title="invite">
                          Invite
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="refer-share mt-30">
                  <p className="text-alter">Share With:</p>
                  <Social />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Refer;
