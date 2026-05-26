"use client";
import apPay from "@/public/images/ap-pay.png";
import gPay from "@/public/images/g-pay.png";
import master from "@/public/images/master.png";
import lockBg from "@/public/images/platform/lock-bg.png";
import va from "@/public/images/va.png";
import Matter, { Bodies, Bounds, Engine, Events, Mouse, MouseConstraint, Render, World } from "matter-js";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
const Secure = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const instance = useRef<null | Render>(null);
  useEffect(() => {
    const containerElement = canvasRef.current!;
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    const engine = Engine.create();
    if (canvasRef.current && !instance.current) {
      instance.current = Render.create({
        element: containerElement,
        engine: engine,
        options: {
          width: containerWidth,
          height: containerHeight,
          pixelRatio: 2,
          background: "#000000",
          wireframes: false,
        },
      });
    }
    // create an engine
    // create a renderer
    // Add the renderer to the DOM
    Render.run(instance.current!);
    // add mouse control
    const mouse = Mouse.create(instance.current!.canvas),
      mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
          stiffness: 0.2,
          render: {
            visible: false,
          },
        },
      });
    // Add bodies to the world
    // create bounds
    const ground = Bodies.rectangle(containerWidth / 2 + 160, containerHeight + 80, containerWidth + 320, 160, { render: { fillStyle: "#fff" }, isStatic: true });
    const wallLeft = Bodies.rectangle(-80, containerHeight / 2, 160, containerHeight, { isStatic: true });
    const wallRight = Bodies.rectangle(containerWidth + 80, containerHeight / 2, 160, 1200, { isStatic: true });
    const roof = Bodies.rectangle(containerWidth / 2 + 160, -80, containerWidth + 320, 160, { isStatic: true });
    const radius = 20;
    // create objects
    // tagVideo & design
    const img1 = Bodies.rectangle(containerWidth / 2 + 150, 500, 120, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/one.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img2 = Bodies.rectangle(containerWidth / 2 - 150, 460, 170, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/two.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img3 = Bodies.rectangle(containerWidth / 2 + 250, 420, 87, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/three.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img4 = Bodies.rectangle(containerWidth / 2 - 75, 380, 140, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/four.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img5 = Bodies.rectangle(containerWidth / 2 - 74, 540, 146, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/five.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img6 = Bodies.rectangle(containerWidth / 2 + 174, 490, 106, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/six.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img7 = Bodies.rectangle(containerWidth / 2 - 142, 440, 142, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/seven.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img8 = Bodies.rectangle(containerWidth / 2 - 10, 260, 88, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/eight.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img9 = Bodies.rectangle(containerWidth / 2 - 242, 420, 150, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/nine.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img10 = Bodies.rectangle(containerWidth / 2 + 60, 300, 104, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/ten.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img11 = Bodies.rectangle(containerWidth / 2, 320, 88, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/eight.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img12 = Bodies.rectangle(containerWidth / 2 - 59, 260, 102, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/twelve.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img13 = Bodies.rectangle(containerWidth / 2 + 110, 260, 102, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/seven.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img14 = Bodies.rectangle(containerWidth / 2 - 110, 296, 120, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/fourteen.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img15 = Bodies.rectangle(containerWidth / 2 - 10, 260, 156, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/fifteen.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img16 = Bodies.rectangle(containerWidth / 2 - 80, 260, 90, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/eight.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img17 = Bodies.rectangle(containerWidth / 2 - 110, 260, 170, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/two.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img18 = Bodies.rectangle(containerWidth / 2 + 90, 260, 164, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/four.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img19 = Bodies.rectangle(containerWidth / 2 + 80, 260, 190, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/two.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img20 = Bodies.rectangle(containerWidth / 2 - 59, 260, 102, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/twelve.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img21 = Bodies.rectangle(containerWidth / 2 - 200, 360, 88, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/three.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img22 = Bodies.rectangle(containerWidth / 2 + 90, 260, 164, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/four.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img23 = Bodies.rectangle(containerWidth / 2 + 80, 260, 170, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/two.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    const img24 = Bodies.rectangle(containerWidth / 2 - 200, 360, 88, 50, {
      chamfer: { radius: radius },
      render: {
        sprite: {
          texture: "./images/matter/three.png",
          xScale: 1,
          yScale: 1,
        },
      },
    });
    // Add created bodies to the world
    World.add(engine.world, [mouseConstraint, ground, wallLeft, wallRight, roof, img1, img2, img3, img4, img5, img6, img7, img8, img9, img10, img11, img12, img13, img14, img15, img16, img17, img18, img19, img20, img21, img22, img23, img24]);
    let click = false;
    document.addEventListener("mousedown", () => (click = true));
    document.addEventListener("mousemove", () => (click = false));
    // Create a On-Mouseup Event-Handler
    Events.on(mouseConstraint, "mouseup", function (event) {
      const mouseConstraint = event.source;
      const bodies = engine.world.bodies;
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (click === true) {
          if (Bounds.contains(body.bounds, mouseConstraint.mouse.position)) {
            break;
          }
        }
      }
      if (!mouseConstraint.body) {
        for (let i = 0; i < bodies.length; i++) {
          const body = bodies[i];
          if (click === true) {
            if (Bounds.contains(body.bounds, mouseConstraint.mouse.position)) {
              break;
            }
          }
        }
      }
    });
    // run the engine
    Matter.Runner.run(engine);
    // run the renderer
    return () => {
      Render.stop(instance.current!);
      Engine.clear(engine);
    };
  }, []);

  return (
    <section className="secure pt-120 fade-wrapper">
      <div className="container-fluid">
        <div className="row vertical-column-gap">
          <div className="col-12 col-xl-5 fade-top">
            <div className="secure__content ">
              <div className="inner">
                <span className="text-xl mt-8 quaternary-text">Secure platform</span>
                <h3 className="fw-6 mt-24 title-animation">Play safely with NFTG</h3>
                <p className="mt-24">2FA, SSL encryption, and multi-sig cold wallet storage empower you to protect your account and funds.</p>
              </div>
              <div className="thumb mt-60">
                <Image src={lockBg} alt="Image" />
              </div>
              <div className="btn-wrapper">
                <Link href="/games" className="btn--secondary">
                  Play Now
                </Link>
                <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                  <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-7 fade-top">
            <div className="secure__content-two pt-120 ">
              <div className="text-center inner">
                <div className="pay-wrapper">
                  <Image src={va} alt="Image" />
                  <Image src={apPay} alt="Image" />
                  <Image src={master} alt="Image" />
                  <Image src={gPay} alt="Image" />
                </div>
                <h3 className="fw-6 mt-24 title-animation">New to crypto?</h3>
                <p className="mt-24">Ultra-easy conversion using Visa, Mastercard, Apple Pay, or GooglePay. Buy crypto safely and securely in seconds.</p>
              </div>
              <div className="m-wrapper mt-60">
                <div className="pill-wrapper overflow-hidden">
                  <div ref={canvasRef} className="pill-container position-relative"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Secure;
