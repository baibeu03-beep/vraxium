import NiceSelect from "@/components/shared/NiceSelect";
import applePay from "@/public/images/apple-pay.png";
import card from "@/public/images/card.png";
import Image from "next/image";

const BuyCrypto = () => {
  return (
    <div className="private-content__single" id="privateCrypto">
      <div className="private-content buy-crypto">
        <form action="#" method="post">
          <div className="profile-input-group">
            <label htmlFor="cryptodepositAmount" className="text-alter fw-6">
              You pay with
            </label>
            <div className="input-wrapper">
              <input type="number" name="cryptodeposit-amount" id="cryptodepositAmount" required placeholder="Enter Amount" />
              <NiceSelect
                options={[
                  { value: "usd", text: "USD" },
                  { value: "euro", text: "Euro" },
                  { value: "uae", text: "UAE" },
                  { value: "peso", text: "Peso" },
                  { value: "real", text: "Real" },
                  { value: "yen", text: "Yen" },
                ]}
                placeholder="Currency"
                onChange={(selectedValue) => {
                  console.log("Selected currency:", selectedValue);
                }}
              />
            </div>
          </div>
          <div className="profile-input-group mt-30">
            <label htmlFor="cryptogetAmount" className="text-alter fw-6">
              You get
            </label>
            <div className="input-wrapper">
              <input type="number" name="cryptoget-amount" id="cryptogetAmount" required placeholder="Enter Amount" />
              <NiceSelect
                options={[
                  { value: "XLM", text: "XLM" },
                  { value: "USDT", text: "USDT" },
                  { value: "BTC", text: "BTC" },
                  { value: "ETH", text: "ETH" },
                  { value: "TRX", text: "TRX" },
                  { value: "BNB", text: "BNB" },
                  { value: "BCD", text: "BCD" },
                ]}
                placeholder="Currency"
                onChange={(selectedValue) => {
                  console.log("Selected cryptocurrency:", selectedValue);
                }}
              />
            </div>
          </div>
          <div className="buy-details mt-30">
            <p className="text-alter fw-6">You get</p>
            <div className="buy-details__inner mt-16">
              <div className="buy-details-group">
                <p className="text-sm text-alter">Provider</p>
                <Image src={applePay} alt="Apple Pay" />
              </div>
              <div className="buy-details-group mt-20">
                <p className="text-sm text-alter">Method</p>
                <Image src={card} alt="Card" />
              </div>
              <div className="buy-details-group mt-20">
                <p className="text-sm text-alter">Deposit to account</p>
                <p>Fcwgdaybmyb</p>
              </div>
            </div>
          </div>
          <div className="buy-details mt-30">
            <div className="buy-details__inner">
              <div className="buy-details-group">
                <p className="text-sm text-alter">Total (including fee)</p>
                <p>30 USD</p>
              </div>
              <div className="buy-details-group mt-20">
                <p className="text-sm text-alter">You will get</p>
                <p className="quaternary-text">19.55 USDT</p>
              </div>
            </div>
          </div>
          <div className="notice mt-30">
            <p>
              <strong className="quaternary-text">Notice: </strong>
              Do not deposit any currency other than XLM
            </p>
          </div>
          <div className="check-group mt-30">
            <div className="check-mark-wrapper">
              <input type="checkbox" name="agree" id="agree" />
              <span className="checkmark"></span>
            </div>
            <div className="check-group-single">
              <p className="text-md">I have read and agree to the disclaimer.</p>
            </div>
            <label htmlFor="agree"></label>
          </div>
          <div className="form-cta mt-40">
            <button type="submit" title="Confirm deposit" className="btn--primary">
              Pay Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BuyCrypto;
