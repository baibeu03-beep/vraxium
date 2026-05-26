"use client";
import one from "@/public/images/cart/one.png";
import three from "@/public/images/cart/three.png";
import two from "@/public/images/cart/two.png";
import Image from "next/image";
import Link from "next/link";
import { Dispatch, SetStateAction } from "react";
type Props = {
  cartIsOpen: boolean;
  setCartIsOpen: Dispatch<SetStateAction<boolean>>;
};
const Cart = ({ cartIsOpen, setCartIsOpen }: Props) => {
  return (
    <>
      <div className={`sidebar-cart ${cartIsOpen ? "sidebar-cart-active" : ""}`}>
        <div className="sidebar-cart__inner">
          <button className="close-cart" onClick={() => setCartIsOpen(false)} aria-label="close cart">
            <i className="ti ti-x"></i>
          </button>
          <h2 className="not-cursor">
            Shopping Bag
            <span className="count-item"></span>
          </h2>
          <div className="cart-items">
            <div className="cart-item-single">
              <div className="cart-item-thumb">
                <Link href="/shop/1">
                  <Image src={one} alt="Image" />
                </Link>
              </div>
              <div className="cart-item-content">
                <p>
                  <Link href="/shop/1" className="not-cursor">
                    Apex Legends
                  </Link>
                </p>
                <p className="price">
                  $<span className="item-price">34.99</span>
                </p>
                <div className="measure">
                  <button aria-label="decrease item" className="quantity-decrease">
                    <i className="ti ti-minus"></i>
                  </button>
                  <span className="item-quantity">0</span>
                  <button aria-label="add item" className="quantity-increase">
                    <i className="ti ti-plus"></i>
                  </button>
                </div>
              </div>
              <button aria-label="delete item" className="delete-item">
                <i className="ti ti-trash"></i>
              </button>
            </div>
            <div className="cart-item-single">
              <div className="cart-item-thumb">
                <Link href="/shop/1">
                  <Image src={two} alt="Image" />
                </Link>
              </div>
              <div className="cart-item-content">
                <p>
                  <Link href="/shop/1" className="not-cursor">
                    Rocket League
                  </Link>
                </p>
                <p className="price">
                  $<span className="item-price">67.32</span>
                </p>
                <div className="measure">
                  <button aria-label="decrease item" className="quantity-decrease">
                    <i className="ti ti-minus"></i>
                  </button>
                  <span className="item-quantity">0</span>
                  <button aria-label="add item" className="quantity-increase">
                    <i className="ti ti-plus"></i>
                  </button>
                </div>
              </div>
              <button aria-label="delete item" className="delete-item">
                <i className="ti ti-trash"></i>
              </button>
            </div>
            <div className="cart-item-single">
              <div className="cart-item-thumb">
                <Link href="/shop/1">
                  <Image src={three} alt="Image" />
                </Link>
              </div>
              <div className="cart-item-content">
                <p>
                  <Link href="/shop/1" className="not-cursor">
                    Tank Firing
                  </Link>
                </p>
                <p className="price">
                  $<span className="item-price">24.00</span>
                </p>
                <div className="measure">
                  <button aria-label="decrease item" className="quantity-decrease">
                    <i className="ti ti-minus"></i>
                  </button>
                  <span className="item-quantity">0</span>
                  <button aria-label="add item" className="quantity-increase">
                    <i className="ti ti-plus"></i>
                  </button>
                </div>
              </div>
              <button aria-label="delete item" className="delete-item">
                <i className="ti ti-trash"></i>
              </button>
            </div>
          </div>
          <div className="empty-cart">
            <h5 className="not-cursor">Your cart is empty</h5>
            <Link href="/shop">Add Products</Link>
          </div>
          <div className="totals">
            <div className="subtotal">
              <span className="label">Subtotal</span>
              <span className="amount ">
                $<span className="total-price">0.00</span>
              </span>
            </div>
          </div>
          <div className="action-buttons">
            <a className="view-cart-button" href="#" aria-label="go to cart">
              View Cart
            </a>
            <a className="checkout-button" href="#" aria-label="go to checkout">
              Checkout
              <i className="ti ti-arrow-narrow-right"></i>
            </a>
          </div>
        </div>
      </div>
      <div onClick={() => setCartIsOpen(false)} className={`cart-backdrop ${cartIsOpen ? "cart-backdrop-active" : ""}`}></div>
    </>
  );
};

export default Cart;
