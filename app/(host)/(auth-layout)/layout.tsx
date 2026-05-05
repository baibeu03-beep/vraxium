import errorThumb from "@/public/images/error/error-thumb.png";
import logo from "@/public/images/logo-alt.png";
import Image from "next/image";
import Link from "next/link";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="nftg-app-alt a-cursor sidebar-add">
      <div className="nftg-thumb">
        <Image src={errorThumb} alt="Page Not Found" className="parallax-image" />
      </div>
      {/* <!-- ==== / thumb end ==== --> */}

      <div className="nftg-layout-two">
        {/* <!-- ==== header start ==== --> */}
        <header className="header-two">
          <div className="container-fluid">
            <div className="row">
              <div className="col-12">
                <div className="navbar p-0">
                  <Link href="/" aria-label="home page" title="logo" className="not-cursor">
                    <Image src={logo} alt="Image" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
