"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { heatScore, products, socialLikes, type Product } from "@/lib/products";

const categories = ["All", "Jackets", "Dresses", "Tops", "Accessories"] as const;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function Flame({ small = false }: { small?: boolean }) {
  return <span className={small ? "flame small" : "flame"} aria-hidden>◆</span>;
}

export default function Storefront() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [selected, setSelected] = useState<Product | null>(null);
  const [size, setSize] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const filtered = useMemo(() => category === "All" ? products : products.filter((p) => p.category === category), [category]);
  const totalLikes = products.reduce((sum, product) => sum + socialLikes(product), 0);

  function openProduct(product: Product) {
    setSelected(product);
    setSize(product.sizes[0]);
    setNotice("");
  }

  async function checkout() {
    if (!selected || !size) return;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selected.id, size }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout is unavailable.");
      window.location.href = data.url;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Checkout is unavailable.");
    } finally { setLoading(false); }
  }

  return <>
    <header className="nav-shell">
      <a className="brand" href="#top" aria-label="Wornly home"><span>W</span> wornly</a>
      <nav aria-label="Main navigation"><a href="#shop">Shop</a><a href="#how">How it works</a></nav>
      <a className="nav-cta" href="#shop">Shop what&apos;s hot</a>
    </header>

    <main id="top">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> Trending in real life</p>
          <h1>Wear what<br/><em>everyone</em><br/>is talking about.</h1>
          <p className="hero-lede">Fashion ranked by real social attention. Discover the pieces creators love, see the proof, then make them yours.</p>
          <a className="primary-button" href="#shop">Explore the heat <span>↘</span></a>
          <div className="hero-stats"><div><strong>{compact.format(totalLikes)}+</strong><span>community likes</span></div><div><strong>{products.reduce((n,p) => n + p.socialPosts.length, 0)}</strong><span>featured looks</span></div><div><strong>6</strong><span>rising pieces</span></div></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo"><Image src={products[0].image} alt={products[0].imageAlt} fill priority sizes="(max-width: 800px) 100vw, 48vw" /></div>
          <div className="floating-card top"><div className="avatar">MC</div><div><strong>@mayamoves</strong><span>18.4K likes</span></div><span className="mini-heart">♥</span></div>
          <div className="floating-card heat"><Flame/><div><span>Social heat</span><strong>{heatScore(products[0])}/100</strong></div></div>
          <div className="hero-caption"><span>01</span><div><strong>{products[0].name}</strong><small>seen on 3 creators</small></div><b>${products[0].price}</b></div>
        </div>
      </section>

      <section className="ticker" aria-label="Trending categories"><span>AS SEEN ON YOUR FEED</span><b>✦</b><span>CURATED BY CULTURE</span><b>✦</b><span>POWERED BY SOCIAL PROOF</span><b>✦</b><span>SHOP THE MOMENT</span></section>

      <section className="shop-section" id="shop">
        <div className="section-heading"><div><p className="eyebrow">The social edit</p><h2>Currently <em>heating up</em></h2></div><p>Every piece has receipts. Browse creator looks, compare the attention, and shop with context.</p></div>
        <div className="filters" role="group" aria-label="Product categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="product-grid">{filtered.map((product, index) => <article className={`product-card card-${index % 3}`} key={product.id}>
          <button className="image-button" onClick={() => openProduct(product)} aria-label={`View ${product.name}`}>
            <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" />
            <span className="heat-pill"><Flame small /> {heatScore(product)} hot</span>
            <span className="view-pill">View piece ↗</span>
          </button>
          <div className="product-meta"><div><span>{product.brand}</span><button onClick={() => openProduct(product)}>{product.name}</button></div><strong>${product.price}</strong></div>
          <div className="social-proof"><span className="face-stack">{product.socialPosts.slice(0,3).map((post) => <i key={post.handle}>{post.creator.split(" ").map(x => x[0]).join("")}</i>)}</span><span><b>{compact.format(socialLikes(product))}</b> likes across {product.socialPosts.length} posts</span></div>
        </article>)}</div>
      </section>

      <section className="proof-section" id="how"><div><p className="eyebrow light">Why Wornly</p><h2>Popularity,<br/><em>with proof.</em></h2></div><div className="steps"><article><span>01</span><h3>We spot the signal</h3><p>Creator-approved posts connect social moments to the exact pieces being worn.</p></article><article><span>02</span><h3>We measure the heat</h3><p>Visible engagement rolls into one simple score, so momentum is easy to compare.</p></article><article><span>03</span><h3>You shop the story</h3><p>See who wore it, why it resonated, and buy the piece without losing the context.</p></article></div></section>
    </main>

    <footer><a className="brand footer-brand" href="#top"><span>W</span> wornly</a><p>The social layer for fashion discovery.</p><span>© 2026 Wornly</span></footer>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
      <div className="modal-image"><Image src={selected.image} alt={selected.imageAlt} fill sizes="(max-width: 800px) 100vw, 45vw" /></div>
      <div className="modal-content"><p className="eyebrow">{selected.brand}</p><h2 id="product-title">{selected.name}</h2><div className="modal-price"><strong>${selected.price}</strong><span><Flame small /> {heatScore(selected)} social heat</span></div><p>{selected.description}</p>
        <div className="receipt"><div><strong>{compact.format(socialLikes(selected))}</strong><span>combined likes</span></div><div><strong>{selected.socialPosts.length}</strong><span>creator posts</span></div></div>
        <h3>Seen in the wild</h3><div className="post-list">{selected.socialPosts.map((post) => <article key={post.handle}><div className="avatar">{post.creator.split(" ").map(x => x[0]).join("")}</div><div><strong>{post.handle}</strong><p>“{post.caption}”</p><span>{post.platform} · {compact.format(post.likes)} likes</span></div></article>)}</div>
        <label className="size-label">Choose size <select value={size} onChange={(e) => setSize(e.target.value)}>{selected.sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="checkout" onClick={checkout} disabled={loading}>{loading ? "Opening checkout…" : `Buy now · $${selected.price}`}</button>
        {notice && <p className="notice" role="status">{notice}</p>}<small className="secure">Secure checkout powered by Stripe</small>
      </div>
    </section></div>}
  </>;
}
