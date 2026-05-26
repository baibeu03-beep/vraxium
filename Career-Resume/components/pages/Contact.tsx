const Contact = () => {
  return (
    <section className="contact pt-120 pb-120 fade-wrapper">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="text-center mb-50">
              <h2 className="title-lg fw-8 stroked-text transform-none title-animation mt-8">Contact Us</h2>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-lg-4">
            <div className="contact__content">
              <div className="contact__intro fade-top">
                <h4 className="fw-7 mt-8">Get In Touch</h4>
                <p className="mt-12 text-alter">Contact Management for Organizing, Leveraging and Maintaining Your Network</p>
              </div>
              <hr className="divider mt-40 mb-40" />
              <div className="contact__information fade-top">
                <h4 className="fw-7 mt-8">Information</h4>
                <div className="contact__information-wrapper mt-20">
                  <div className="contact__infromation-single">
                    <div className="thumb">
                      <i className="ti ti-phone-call"></i>
                    </div>
                    <div className="content">
                      <p className="text-md text-alter fw-6">Phone:</p>
                      <p className="text-xl fw-6 mt-6">
                        <a href="tel:629-555-0129">(629) 555-0129</a>
                      </p>
                    </div>
                  </div>
                  <div className="contact__infromation-single">
                    <div className="thumb">
                      <i className="ti ti-map-pin"></i>
                    </div>
                    <div className="content">
                      <p className="text-md text-alter fw-6">Location:</p>
                      <p className="text-xl fw-6 mt-6">
                        <a href="https://goo.gl/maps/16KHwiUcctAojuLj8" target="_blank">
                          575, Napatanka, USA
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="contact__infromation-single">
                    <div className="thumb">
                      <i className="ti ti-mail"></i>
                    </div>
                    <div className="content">
                      <p className="text-md text-alter fw-6">E-mail:</p>
                      <p className="text-xl fw-6 mt-6">
                        <a href="mailto:binhan628@gmail.com">info@email.com</a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-7 offset-lg-1">
            <div className="contact__form">
              <form action="#" method="post">
                <div className="input-single fade-top">
                  <div className="ic-group">
                    <input type="text" name="contact-name" id="contactName" placeholder="Your Name" required />
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                      <path d="M0 0  L100 0  L100 79 L96 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                </div>
                <div className="input-single fade-top">
                  <div className="ic-group">
                    <input type="email" name="contact-email" id="contactEmail" placeholder="Your Email" required />
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                      <path d="M0 0  L100 0  L100 79 L96 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                </div>
                <div className="input-single fade-top">
                  <div className="ic-group">
                    <input type="text" name="contact-number" id="contactNumber" placeholder="Phone Number" required />
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                      <path d="M0 0  L100 0  L100 79 L96 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                </div>
                <div className="input-single fade-top">
                  <div className="ic-group">
                    <textarea name="c-message" id="cMessage" cols={30} rows={10} placeholder="Type Your Message..."></textarea>
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                      <path d="M0 0  L100 0  L100 79 L96 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                </div>
                <div className="section__cta mt-40">
                  <div className="btn-wrapper">
                    <button type="submit" aria-label="send message" title="send message" className="btn--secondary">
                      Submit Now{" "}
                    </button>
                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
