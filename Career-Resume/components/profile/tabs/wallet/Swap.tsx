import NiceSelect from "@/components/shared/NiceSelect";

const Swap = () => {
  return (
    <div className="private-content__single" id="privateSwap">
      <div className="private-content buy-crypto">
        <form action="#" method="post">
          <div className="profile-input-group">
            <label htmlFor="swapdepositAmount" className="text-alter fw-6">
              You get Approximately
            </label>
            <div className="input-wrapper">
              <input type="number" name="swapdeposit-amount" id="swapdepositAmount" required placeholder="0" />
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
                onChange={(selectedValue) => console.log(selectedValue)}
              />
            </div>
          </div>
          <div className="profile-input-group mt-12">
            <div className="input-wrapper">
              <input type="number" name="swapget-amount" id="swapgetAmount" required placeholder="30" />
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
                onChange={(selectedValue) => console.log(selectedValue)}
              />
            </div>
          </div>
          <div className="buy-details buy-details-alt mt-30">
            <div className="buy-details__intro">
              <p className="text-sm fw-6">1 XLM ≈ 0.07840164 BCD</p>
            </div>
            <div className="buy-details__inner">
              <div className="buy-details-group mt-20">
                <p className="text-sm text-alter">Estimated Time*</p>
                <p>12 Hours</p>
              </div>
              <div className="buy-details-group mt-16">
                <p className="text-sm text-alter">Swap fee:</p>
                <p>0.04000- XLM</p>
              </div>
            </div>
          </div>
          <div className="form-cta mt-40">
            <button type="submit" title="Confirm deposit" className="btn--primary">
              Swap Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Swap;
