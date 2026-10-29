/* eslint-disable @next/next/no-img-element -- Small local brand assets and source-attributed component photography. */
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Camera,
  FileText,
  ScanLine,
  ChevronRight,
} from "lucide-react";
import { BRAND } from "@/lib/branding";
import type { createGeneratorScene } from "./generator-scene";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function AssemblyFallback() {
  return (
    <svg className="assembly-fallback" viewBox="0 0 900 700" aria-hidden="true">
      <defs>
        <linearGradient id="machine-metal" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#e9eef5" />
          <stop offset=".35" stopColor="#6e839a" />
          <stop offset=".65" stopColor="#d8e0e9" />
          <stop offset="1" stopColor="#536273" />
        </linearGradient>
        <linearGradient id="machine-body">
          <stop stopColor="#364b48" />
          <stop offset=".5" stopColor="#81918b" />
          <stop offset="1" stopColor="#2b3c3b" />
        </linearGradient>
      </defs>
      <g transform="translate(170 90) rotate(-12 300 280)">
        <path d="M260 188 480 100 648 175 430 265Z" fill="#647773" />
        <path d="m430 265 218-90v240l-218 85Z" fill="url(#machine-body)" />
        <path d="M260 188v240l170 72V265Z" fill="#2d4146" />
        <ellipse
          cx="343"
          cy="339"
          rx="107"
          ry="130"
          fill="#18212e"
          stroke="url(#machine-metal)"
          strokeWidth="17"
        />
        <ellipse
          cx="343"
          cy="339"
          rx="82"
          ry="103"
          fill="none"
          stroke="#ba885e"
          strokeWidth="12"
          strokeDasharray="7 8"
        />
        <path d="m223 467 220 84 243-91v26l-244 91-219-83Z" fill="#344353" />
        <g className="fallback-gear" transform="translate(204 330)">
          <circle
            r="102"
            fill="#172330"
            stroke="url(#machine-metal)"
            strokeWidth="28"
            strokeDasharray="16 7"
          />
          <circle r="76" fill="url(#machine-metal)" />
          <circle r="18" fill="#0b1420" />
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <circle
              key={angle}
              cx={Math.cos((angle * Math.PI) / 180) * 48}
              cy={Math.sin((angle * Math.PI) / 180) * 48}
              r="12"
              fill="#182330"
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

export default function LandingPage() {
  const storyRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const story = storyRef.current,
      stage = stageRef.current,
      host = sceneRef.current;
    if (!story || !stage || !host) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false,
      frame = 0,
      visible = true,
      target = 0,
      current = 0,
      pointerX = 0,
      pointerY = 0;
    let scene: ReturnType<typeof createGeneratorScene> | undefined;

    const paint = () => {
      frame = 0;
      current += (target - current) * 0.11;
      if (Math.abs(current - target) < 0.0005) current = target;
      const p = motion.matches ? 0 : current;
      stage.style.setProperty("--assembly-progress", String(p));
      stage.style.setProperty(
        "--intro-opacity",
        String(1 - smooth((p - 0.08) / 0.2)),
      );
      stage.style.setProperty(
        "--middle-opacity",
        String(smooth((p - 0.25) / 0.12) * (1 - smooth((p - 0.57) / 0.12))),
      );
      stage.style.setProperty(
        "--final-opacity",
        String(smooth((p - 0.72) / 0.15)),
      );
      stage.dataset.step = p < 0.3 ? "1" : p < 0.72 ? "2" : "3";
      if (scene && visible && !document.hidden)
        scene.render(
          motion.matches ? 1 : current,
          motion.matches ? 0 : pointerX,
          motion.matches ? 0 : pointerY,
        );
      if (current !== target && visible) frame = requestAnimationFrame(paint);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const scroll = () => {
      const rect = story.getBoundingClientRect();
      target = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight));
      schedule();
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || motion.matches) return;
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) scroll();
    });
    observer.observe(story);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    window.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", scroll);
    scroll();
    void import("./generator-scene")
      .then(({ createGeneratorScene }) => {
        if (disposed) return;
        try {
          scene = createGeneratorScene(host);
          stage.dataset.renderer = "webgl";
          schedule();
        } catch {
          stage.dataset.renderer = "fallback";
        }
      })
      .catch(() => {
        if (!disposed) stage.dataset.renderer = "fallback";
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
      window.removeEventListener("pointermove", pointer);
      document.removeEventListener("visibilitychange", schedule);
      motion.removeEventListener("change", scroll);
      scene?.dispose();
    };
  }, []);

  return (
    <div className="falcon-landing">
      <a href="#workflow" className="landing-skip">
        Skip animation
      </a>
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="FalconID home">
          <img src="/falconid-mark.svg" width="32" height="32" alt="" />
          {BRAND.name}
        </Link>
        <nav aria-label="Landing navigation">
          <a href="#workflow">How it works</a>
          <Link href="/identify" className="landing-nav-cta">
            Open FalconID <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <main>
        <section
          className="assembly-story"
          id="assembly"
          ref={storyRef}
          aria-label="Scroll-controlled generator assembly"
        >
          <div className="assembly-stage" ref={stageRef} data-step="1">
            <div className="assembly-atmosphere" />
            <div className="assembly-grid" />
            <div className="assembly-canvas" ref={sceneRef} />
            <AssemblyFallback />
            <div className="assembly-vignette" />
            <div className="assembly-copy assembly-intro">
              <p className="landing-eyebrow">
                <span /> A clearer picture of every component
              </p>
              <h1>
                From photo
                <br />
                to <span>part.</span>
              </h1>
              <p className="landing-lede">
                Small component. Bigger picture.
                <br />
                Find the part record and the documents behind it.
              </p>
              <Link href="/identify" className="landing-button">
                Identify a part <ArrowRight size={18} />
              </Link>
              <a href="#workflow" className="landing-secondary">
                See how it works <ChevronRight size={15} />
              </a>
            </div>
            <div className="assembly-copy assembly-middle" aria-hidden="true">
              <p className="landing-eyebrow">01 — Make the connection</p>
              <h2>
                Every detail
                <br />
                has a place.
              </h2>
              <p className="landing-lede">
                A shape. A marking. A familiar edge.
                <br />
                Bring the component back into context.
              </p>
            </div>
            <div className="assembly-copy assembly-final" aria-hidden="true">
              <p className="landing-eyebrow">02 — See the whole picture</p>
              <h2>
                The part.
                <br />
                The context.
                <br />
                <span>The next step.</span>
              </h2>
              <p className="landing-lede">
                Go from a photo to a source-linked record,
                <br />
                without losing sight of the equipment.
              </p>
            </div>
            <div className="assembly-caption">
              <span className="assembly-caption-dot" />
              <span>Generator assembly study</span>
              <span className="assembly-caption-detail">
                Scroll-controlled 3D illustration
              </span>
            </div>
            <div className="assembly-scroll">
              <ArrowDown size={15} />
              <span>Scroll to assemble</span>
            </div>
            <div className="assembly-rail" aria-hidden="true">
              <span />
              <i />
              <span />
              <i />
              <span />
            </div>
            <div className="assembly-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        </section>

        <section className="landing-workflow" id="workflow">
          <div className="landing-section-head">
            <p className="landing-eyebrow">LESS SEARCHING. MORE CONTEXT.</p>
            <h2>
              One photo.
              <br />
              <span>A useful next step.</span>
            </h2>
            <p>
              For the small components that keep
              <br className="desktop-break" /> the bigger equipment moving.
            </p>
          </div>
          <div className="workflow-grid">
            <article>
              <div className="workflow-number">
                01 <Camera size={23} strokeWidth={1.4} />
              </div>
              <h3>See it.</h3>
              <p>
                Take a clear photo. Add a second angle or capture the part’s
                markings.
              </p>
              <span>Start with what’s in front of you.</span>
            </article>
            <article>
              <div className="workflow-number">
                02 <ScanLine size={23} strokeWidth={1.4} />
              </div>
              <h3>Find its match.</h3>
              <p>
                Image vectors search the library. AI reviews reference photos
                and visible details.
              </p>
              <span>A shortlist grounded in the database.</span>
            </article>
            <article>
              <div className="workflow-number">
                03 <FileText size={23} strokeWidth={1.4} />
              </div>
              <h3>Get the context.</h3>
              <p>
                Open part numbers, equipment links, Technical Orders and source
                documentation.
              </p>
              <span>The record, all in one place.</span>
            </article>
          </div>
        </section>

        <section className="landing-record" aria-labelledby="record-heading">
          <div className="record-visual">
            <div className="record-photo">
              <img
                src="/assets/components/mep-fuel-01-real.jpg"
                alt="WIX 33583 fuel filter reference photograph"
                width="280"
                height="280"
                loading="lazy"
              />
              <span className="record-corner corner-tl" />
              <span className="record-corner corner-tr" />
              <span className="record-corner corner-bl" />
              <span className="record-corner corner-br" />
            </div>
            <div className="record-result">
              <div className="record-result-heading">
                <span className="record-result-dot" /> A record with a source{" "}
                <span>MEP-832A</span>
              </div>
              <h3>Fuel filter element</h3>
              <div className="record-identifiers">
                <div>
                  <small>PART NUMBER</small>
                  <strong>33583</strong>
                </div>
                <div>
                  <small>NSN</small>
                  <strong>4330-01-374-9147</strong>
                </div>
              </div>
              <a
                href="https://www.radiomanual.info/schemi/Surplus_Accessories/MEP-831A_MEP-832A_serv_user_TM9-6115-639-13P_2010.pdf#page=445"
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={17} />
                <span>
                  TO 35C2-3-386-51W/IPB
                  <small>Parts breakdown · Figure 25 · Item 7</small>
                </span>
                <ArrowRight size={15} />
              </a>
            </div>
          </div>
          <div className="record-copy">
            <p className="landing-eyebrow">MORE THAN A PICTURE MATCH</p>
            <h2>
              The details
              <br />
              that matter.
            </h2>
            <p>
              A match should lead somewhere. FalconID connects candidate
              components to existing records, equipment and technical
              publications.
            </p>
            <p className="record-note">
              Review the part’s markings and current authorized documentation
              before maintenance.
            </p>
            <Link href="/identify" className="landing-text-link">
              Explore the part library <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        <section className="landing-last">
          <p className="landing-eyebrow">BRING THE PICTURE TOGETHER</p>
          <h2>
            Your next part
            <br />
            starts with a photo.
          </h2>
          <Link href="/identify" className="landing-button">
            Open FalconID <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/" className="landing-brand">
          <img src="/falconid-mark.svg" width="28" height="28" alt="" />
          {BRAND.name}
        </Link>
        <span>{BRAND.tagline}</span>
        <Link href="/identify">
          Identify a part <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
