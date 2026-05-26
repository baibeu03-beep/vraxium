"use client";
import NiceSelect from "@/components/shared/NiceSelect";
import qr from "@/public/images/qr.png";
import Image from "next/image";
import { useState } from "react";
const amounts = [100, 200, 300, 500];
const Deposit = () => {
  const [activeTab, setActiveTab] = useState("crypto");
  const [selectedAmount, setSelectedAmount] = useState(amounts[0]);
  return (
    <div className="private-content__single" id="privateDeposit">
      <div className="private-content">
        <div className="deposit-tab__btns">
          <ul>
            <li>
              <button onClick={() => setActiveTab("crypto")} className={`deposit-tab-btn ${activeTab === "crypto" ? "active" : ""}`}>
                Crypto
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab("flat")} className={`deposit-tab-btn ${activeTab === "flat" ? "active" : ""}`}>
                Flat
              </button>
            </li>
          </ul>
        </div>
        <div className="deposit-tab__items mt-40">
          {activeTab == "crypto" ? (
            <div className="deposit-tab__single" id="depositCrypto">
              <form action="#" method="post">
                <div className="profile-input-group">
                  <label htmlFor="depositMethod" className="text-alter fw-6">
                    Choose Payment Method
                  </label>
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
                    placeholder="Choose Payment Method"
                    onChange={(selectedValue) => {
                      // Handle the selected value here
                      console.log("Selected value:", selectedValue);
                    }}
                  />
                </div>
                <div className="profile-input-group mt-30">
                  <label htmlFor="depositNetwork" className="text-alter fw-6">
                    Choose Network
                  </label>
                  <NiceSelect
                    options={[
                      { value: "stellar", text: "Stellar" },
                      { value: "ripple", text: "Ripple" },
                      { value: "blockstream", text: "Blockstream" },
                    ]}
                    placeholder="Choose Network"
                    onChange={(selectedValue) => {
                      // Handle the selected value here
                      console.log("Selected network:", selectedValue);
                    }}
                  />
                </div>
                <div className="profile-input-group mt-30">
                  <label htmlFor="depositAmount" className="text-alter fw-6">
                    Deposit Amount
                  </label>
                  <div className="input-wrapper">
                    <input type="number" name="deposit-amount" id="depositAmount" placeholder="Enter Amount" />
                  </div>
                </div>
                <div className="deposit-address mt-30">
                  <p className="fw-5 text-alter">
                    Get extra <span className="text-white">180%</span> bonus on minimum of <span className="text-white">122.9 XLM</span>
                    deposit
                  </p>
                  <div className="deposit-address__inner mt-12">
                    <div className="deposit-address__thumb">
                      <Image src={qr} alt="Image" />
                    </div>
                    <div className="deposit-address__content">
                      <div className="deposit-content-group">
                        <p className="text-sm text-alter">Deposit Address</p>
                        <div className="deposit-address-inner mt-12">
                          <p className="text-sm fw-5">
                            <span className="quaternary-text">GDS4</span>HKW74QFQ2JEFTT5W5OXQBEPP3C6I6VNZSMSVSKI7DXYS332<span className="quaternary-text">U5H2W</span>
                          </p>
                          <span className="copy-btn text-sm">COPY</span>
                        </div>
                      </div>
                      <div className="deposit-content-group mt-30">
                        <p className="text-sm text-alter">
                          Memo <span className="primary-text">(requieed for deposit)</span>
                        </p>
                        <div className="deposit-address-inner mt-12">
                          <p className="text-sm fw-5">769098765</p>
                          <span className="copy-btn text-sm">COPY</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="notice mt-30">
                  <p>
                    <strong className="quaternary-text">Notice:</strong> Do not deposit any currency other than XLM
                  </p>
                </div>
                <div className="form-cta mt-40">
                  <button type="submit" title="Confirm deposit" className="btn--primary">
                    Deposit Now
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="deposit-tab__single" id="depositFlat">
              <form action="#" method="post">
                <div className="profile-input-group">
                  <label htmlFor="depositMethodFlat" className="text-alter fw-6">
                    Choose Payment Method
                  </label>
                  <NiceSelect
                    options={[
                      { value: "payoneer", text: "Payoneer" },
                      { value: "paypal", text: "Paypal" },
                      { value: "credit", text: "Credit Card" },
                      { value: "mastercard", text: "Mastercard" },
                    ]}
                    placeholder="Choose Payment Method"
                    onChange={(selectedValue) => {
                      // Handle the selected value here
                      console.log("Selected payment method:", selectedValue);
                    }}
                  />
                </div>
                <div className="profile-input-group input-balance mt-30">
                  <label htmlFor="depositAmountFlat" className="text-alter fw-6">
                    Deposit Amount (Min - $50)
                  </label>
                  <div className="input-wrapper">
                    <input type="number" min="50" value={selectedAmount} onChange={(e) => setSelectedAmount(Number(e.target.value))} name="deposit-amount-flat" id="depositAmountFlat" placeholder="Enter Amount" />
                  </div>
                  <div className="input-balance-wrapper mt-30">
                    {amounts.map((amount) => (
                      <p onClick={() => setSelectedAmount(amount)} key={amount} className={`input-balance-single ${amount === selectedAmount ? "active" : ""}`}>
                        $ {amount} USD
                      </p>
                    ))}
                  </div>
                </div>
                <div className="form-cta mt-40">
                  <button type="submit" title="Confirm deposit" className="btn--primary">
                    Deposit Now
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Deposit;
