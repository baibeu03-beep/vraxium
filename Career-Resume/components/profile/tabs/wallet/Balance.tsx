"use client";

import bcdCoin from "@/public/images/coin/bcd.png";
import bnbCoin from "@/public/images/coin/bnb.png";
import btcCoin from "@/public/images/coin/btc.png";
import coin from "@/public/images/coin/coin.png";
import ethCoin from "@/public/images/coin/eth.png";
import maticCoin from "@/public/images/coin/matic.png";
import trxCoin from "@/public/images/coin/trx.png";
import usdCoin from "@/public/images/coin/usd.png";
import usdtCoin from "@/public/images/coin/usdt.png";
import Image, { StaticImageData } from "next/image";

const Balance = () => {
  const flatCurrencies = [{ name: "USD", image: usdCoin }];

  const cryptoCurrencies = [
    { name: "BCD", image: bcdCoin },
    { name: "ETH", image: ethCoin },
    { name: "USDT", image: usdtCoin },
    { name: "BTC", image: btcCoin },
    { name: "TRX", image: trxCoin },
    { name: "BNB", image: bnbCoin },
    { name: "MATIC", image: maticCoin },
  ];

  const renderCurrencyRow = (currency: { name: string; image: StaticImageData | string }) => (
    <tr key={currency.name}>
      <td>
        <Image src={currency.image} alt={currency.name} width={24} height={24} />
        {currency.name}
      </td>
      <td>
        <span className="fw-6">$ 0.00</span>
        <span className="fw-6 text-sm">$0.000000</span>
      </td>
      <td>
        <button data-target="#privateDeposit" title="deposit balance" className="private-sidebar-tab-btn">
          Deposit
        </button>
      </td>
      <td>
        <button data-target="#privateWithdraw" title="withdraw balance" className="private-tab-btn">
          Withdraw
        </button>
      </td>
    </tr>
  );

  return (
    <div className="private-content__single" id="privateBalance">
      <div className="private-content">
        <div className="intro">
          <span className="fw-6 mt-5 text-xxl">Total Balance</span>
          <h4 className="fw-6 primary-text mt-16">
            {" "}
            <Image src={coin} alt="Coin" width={24} height={24} />
            $0
          </h4>
        </div>
        <div className="balance-header mt-35">
          <div className="balance-header__left">
            <p className="text-lg text-alter">Hide 0 balance</p>
            <label>
              <input type="checkbox" />
              <span className="toggle_background"></span>
            </label>
          </div>
          <div className="balance-header__right">
            <form action="#" method="post" autoComplete="off">
              <div className="search-wrap">
                <input type="search" name="profile-balance" id="profileBalance" placeholder="Search" required />
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                  <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                </svg>
                <button type="submit" aria-label="search nft" title="search nft">
                  <i className="ti ti-search"></i>
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="private-table-group mt-40">
          <h6 className="fw-6">Flat Currency</h6>
          <div className="private-table">
            <div className="table-responsive mt-16">
              <table>
                <tbody>{flatCurrencies.map(renderCurrencyRow)}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="private-table-group mt-40">
          <h6 className="fw-6">Crypto Currency</h6>
          <div className="private-table">
            <div className="table-responsive mt-16">
              <table>
                <tbody>{cryptoCurrencies.map(renderCurrencyRow)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Balance;
