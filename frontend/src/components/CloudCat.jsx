export default function CloudCat() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-cloud art-cloud-back" />
      <div className="art-cloud art-cloud-front" />
      <div className="sun-disc" />
      <svg className="cat-illustration" viewBox="0 0 300 300" fill="none">
        <path d="M70 257c-13-18-19-42-18-72 1-31 7-57 22-74l-2-66 51 37c18-6 37-6 55 0l50-37-2 66c16 20 23 48 23 79 0 58-30 87-91 87H117c-22 0-37-7-47-20Z" fill="currentColor" />
        <path d="m78 117-2-48 36 25M213 117l2-48-36 25" fill="currentColor" />
        <path d="M105 155c8-8 17-8 25 0M169 155c8-8 17-8 25 0" stroke="var(--cat-face)" strokeWidth="8" strokeLinecap="round" />
        <path d="m144 176 11 7 11-7" stroke="var(--cat-face)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M155 183c-1 13-11 18-22 17M155 183c1 13 11 18 22 17" stroke="var(--cat-face)" strokeWidth="6" strokeLinecap="round" />
        <path d="M99 181 52 174M101 194l-48 6M211 181l47-7M209 194l48 7" stroke="var(--cat-face)" strokeWidth="4" strokeLinecap="round" opacity=".8" />
        <path d="M84 215c24 19 45 28 71 28 29 0 51-9 72-28" stroke="var(--cat-face)" strokeWidth="6" strokeLinecap="round" opacity=".35" />
      </svg>
      <div className="sparkle sparkle-one">✦</div>
      <div className="sparkle sparkle-two">✧</div>
    </div>
  )
}

