"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { products as seedProducts, type Product } from "@/lib/products";

const categories = ["All", "Jackets", "Dresses", "Tops", "Accessories"] as const;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
type CommunityVote = { likes: number; dislikes: number; vote: "like" | "dislike" | null };
type CartItem = { variantId: string; quantity: number };
type CartQuote = { lines: Array<{ variantId: string; productName: string; variantLabel: string; unitPriceCents: number; quantity: number; lineTotalCents: number }>; subtotalCents: number; totalQuantity: number };
type SocialEvidence = { product_id:string; id:string; platform:string; canonical_url:string; creator_handle:string; likes:number|null; captured_at:string|null; source:string|null };
type ApiProduct={id:string;name:string;brand:string;category:string;description:string;image:string;imageAlt:string;color:string;featured?:boolean;sellerType?:"first_party"|"creator";creatorHandle?:string|null;fulfillmentModel?:"stocked"|"creator_dropship";variants:Array<{id:string;label:string;priceCents:number;active:boolean;inventory:number}>};
const variantId = (productId: string, label: string) => `${productId}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function Flame({ small = false }: { small?: boolean }) {
  return <span className={small ? "flame small" : "flame"} aria-hidden>◆</span>;
}

function VoteButtons({ product, current, busy, modal = false, onVote }: { product: Product; current: CommunityVote; busy: boolean; modal?: boolean; onVote: (productId: string, vote: "like" | "dislike") => void }) {
  return <div className={`vote-controls ${modal ? "modal-votes" : ""}`} aria-label={`Community votes for ${product.name}`}>
    <button className={current.vote === "like" ? "selected" : ""} disabled={busy} onClick={() => onVote(product.id, "like")} aria-pressed={current.vote === "like"} aria-label={`Like ${product.name}`}><span aria-hidden>♥</span><b>{current.likes}</b></button>
    <button className={current.vote === "dislike" ? "selected dislike" : "dislike"} disabled={busy} onClick={() => onVote(product.id, "dislike")} aria-pressed={current.vote === "dislike"} aria-label={`Dislike ${product.name}`}><span aria-hidden>×</span><b>{current.dislikes}</b></button>
  </div>;
}

export default function Storefront() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [selected, setSelected] = useState<Product | null>(null);
  const [size, setSize] = useState("");
  const [notice, setNotice] = useState("");
  const [voteNotice, setVoteNotice] = useState("");
  const [votes, setVotes] = useState<Record<string, CommunityVote>>({});
  const [voting, setVoting] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartQuote, setCartQuote] = useState<CartQuote | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [evidence, setEvidence] = useState<SocialEvidence[]>([]);
  const [catalogProducts,setCatalogProducts]=useState<Product[]>(seedProducts);
  const filtered = useMemo(() => category === "All" ? catalogProducts : catalogProducts.filter((p) => p.category === category), [category,catalogProducts]);
  const evidenceFor = (productId:string) => evidence.filter((item)=>item.product_id===productId);
  const totalLikes = evidence.reduce((sum,item)=>sum+(Number(item.likes)||0),0);

  useEffect(() => {
    fetch("/api/votes").then((response) => response.json()).then((data) => setVotes(data.votes ?? {})).catch(() => setVoteNotice("Community voting is temporarily unavailable."));
    fetch("/api/cart").then((response) => response.json()).then((data) => { setCartItems(data.cart?.items ?? []); setCartQuote(data.quote ?? null); }).catch(() => undefined);
    fetch("/api/social-evidence").then((response)=>response.json()).then((data)=>setEvidence(data.evidence??[])).catch(()=>setEvidence([]));
    fetch("/api/catalog").then(response=>response.json()).then(data=>{if(!Array.isArray(data.products)||!data.products.length)return;setCatalogProducts(data.products.map((p:ApiProduct)=>{const variants=p.variants.filter(v=>v.active&&v.inventory>0);return{id:p.id,name:p.name,brand:p.brand,category:p.category,price:(variants[0]?.priceCents??0)/100,image:p.image,imageAlt:p.imageAlt,description:p.description,sizes:variants.map(v=>v.label),variantIds:Object.fromEntries(variants.map(v=>[v.label,v.id])),color:p.color,socialPosts:[],featured:p.featured,sellerType:p.sellerType,creatorHandle:p.creatorHandle??undefined,fulfillmentModel:p.fulfillmentModel}}).filter((p:Product)=>p.sizes.length))}).catch(()=>undefined);
  }, []);

  async function updateCart(items: CartItem[]) {
    setCartBusy(true); setNotice("");
    try {
      const response = await fetch("/api/cart", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cart could not be updated.");
      setCartItems(data.cart.items); setCartQuote(data.quote);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Cart could not be updated."); }
    finally { setCartBusy(false); }
  }

  async function addToCart() {
    if (!selected || !size) return;
    const id = selected.variantIds?.[size] ?? variantId(selected.id, size);
    const existing = cartItems.find((item) => item.variantId === id);
    await updateCart(existing ? cartItems.map((item) => item.variantId === id ? { ...item, quantity: item.quantity + 1 } : item) : [...cartItems, { variantId: id, quantity: 1 }]);
    setSelected(null); setCartOpen(true);
  }

  async function castVote(productId: string, vote: "like" | "dislike") {
    setVoting(productId);
    setVoteNotice("");
    try {
      const response = await fetch("/api/votes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, vote }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your vote could not be saved.");
      setVotes((current) => ({ ...current, [productId]: { likes: data.likes, dislikes: data.dislikes, vote: data.vote } }));
    } catch (error) {
      setVoteNotice(error instanceof Error ? error.message : "Your vote could not be saved.");
    } finally { setVoting(""); }
  }


  function openProduct(product: Product) {
    setSelected(product);
    setSize(product.sizes[0]);
    setNotice("");
  }

  async function checkout() {
    if (!cartQuote) return;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
      <button className="nav-cta cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Cart, ${cartQuote?.totalQuantity ?? 0} item${cartQuote?.totalQuantity === 1 ? "" : "s"}`}>Cart · {cartQuote?.totalQuantity ?? 0}</button>
    </header>

    <main id="top">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> Trending in real life</p>
          <h1>Wear what<br/><em>everyone</em><br/>is talking about.</h1>
          <p className="hero-lede">Discover independent fashion, compare community reactions, and review only rights-confirmed social evidence before you buy.</p>
          <a className="primary-button" href="#shop">Explore the heat <span>↘</span></a>
          <div className="hero-stats"><div><strong>{compact.format(totalLikes)}</strong><span>approved platform likes</span></div><div><strong>{evidence.length}</strong><span>rights-confirmed posts</span></div><div><strong>{catalogProducts.length}</strong><span>available pieces</span></div></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo"><Image src={catalogProducts[0].image} alt={catalogProducts[0].imageAlt} fill priority sizes="(max-width: 800px) 100vw, 48vw" /></div>
          {evidenceFor(catalogProducts[0].id)[0]&&<div className="floating-card top"><div className="avatar">✓</div><div><strong>@{evidenceFor(catalogProducts[0].id)[0].creator_handle}</strong><span>rights-confirmed source</span></div></div>}
          <div className="floating-card heat"><Flame/><div><span>Community rating</span><strong>{votes[catalogProducts[0].id]?.likes??0} likes</strong></div></div>
          <div className="hero-caption"><span>01</span><div><strong>{catalogProducts[0].name}</strong><small>{catalogProducts[0].sellerType==="creator"?`Creator dropship · @${catalogProducts[0].creatorHandle}`:"Sold and shipped by Wornly"}</small></div><b>${catalogProducts[0].price}</b></div>
        </div>
      </section>

      <section className="ticker" aria-label="Marketplace commitments"><span>RIGHTS-CONFIRMED SOURCES</span><b>✦</b><span>SERVER-VERIFIED PRICING</span><b>✦</b><span>COMMUNITY VOTING</span><b>✦</b><span>SECURE CHECKOUT</span></section>

      <section className="shop-section" id="shop">
        <div className="section-heading"><div><p className="eyebrow">The community edit</p><h2>Currently <em>heating up</em></h2></div><p>Approved sources are shown with attribution and capture dates. Products without approved evidence make no social claims.</p></div>
        <div className="filters" role="group" aria-label="Product categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="product-grid">{filtered.map((product, index) => <article className={`product-card card-${index % 3}`} key={product.id}>
          <button className="image-button" onClick={() => openProduct(product)} aria-label={`View ${product.name}`}>
            <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" />
            <span className="heat-pill"><Flame small /> {votes[product.id]?.likes??0} community likes</span>
            <span className="view-pill">View piece ↗</span>
          </button>
          <div className="product-meta"><div><span>{product.sellerType==="creator"?`Creator shop · @${product.creatorHandle}`:`${product.brand} · sold by Wornly`}</span><button onClick={() => openProduct(product)}>{product.name}</button></div><strong>${product.price}</strong></div>
          <div className="card-footer"><div className="social-proof"><span>{evidenceFor(product.id).length?<><b>{compact.format(evidenceFor(product.id).reduce((sum,item)=>sum+(Number(item.likes)||0),0))}</b> platform likes across {evidenceFor(product.id).length} approved source(s)</>:"No approved social evidence yet"}</span></div><VoteButtons product={product} current={votes[product.id] ?? { likes: 0, dislikes: 0, vote: null }} busy={voting === product.id} onVote={castVote} /></div>
        </article>)}</div>
        {voteNotice && <p className="vote-notice" role="status">{voteNotice}</p>}
      </section>

      <section className="proof-section" id="how"><div><p className="eyebrow light">Why Wornly</p><h2>Context,<br/><em>with proof.</em></h2></div><div className="steps"><article><span>01</span><h3>Sources need permission</h3><p>Only rights-confirmed, administrator-approved platform links can appear as social evidence.</p></article><article><span>02</span><h3>Snapshots stay labeled</h3><p>Platform engagement shows its capture date and source instead of pretending to be a live review score.</p></article><article><span>03</span><h3>You decide</h3><p>Compare attributed evidence with independent community votes, then buy through server-verified checkout.</p></article></div></section>
    </main>

    <footer><a className="brand footer-brand" href="#top"><span>W</span> wornly</a><p>The social layer for fashion discovery.</p><nav><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/shipping">Shipping</a><a href="/returns">Returns</a><a href="/architecture">How marketplace works</a><a href="/social-rights">Social rights</a><a href="/support">Support</a></nav><span>© 2026 Wornly</span></footer>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
      <div className="modal-image"><Image src={selected.image} alt={selected.imageAlt} fill sizes="(max-width: 800px) 100vw, 45vw" /></div>
      <div className="modal-content"><p className="eyebrow">{selected.sellerType==="creator"?`Sold by @${selected.creatorHandle} · creator dropship`:`${selected.brand} · sold and shipped by Wornly`}</p><h2 id="product-title">{selected.name}</h2><div className="modal-price"><strong>${selected.price}</strong><span><Flame small /> {votes[selected.id]?.likes??0} community likes</span></div><p>{selected.description}</p>
        <div className="receipt"><div><strong>{compact.format(evidenceFor(selected.id).reduce((sum,item)=>sum+(Number(item.likes)||0),0))}</strong><span>approved platform likes</span></div><div><strong>{evidenceFor(selected.id).length}</strong><span>approved sources</span></div></div>
        <div className="modal-community"><span>Rate this piece</span><VoteButtons product={selected} current={votes[selected.id] ?? { likes: 0, dislikes: 0, vote: null }} busy={voting === selected.id} modal onVote={castVote} /></div>
        {voteNotice && <p className="notice" role="status">{voteNotice}</p>}
        <h3>Approved social evidence</h3><div className="post-list">{evidenceFor(selected.id).length?evidenceFor(selected.id).map((post) => <article key={post.id}><div className="avatar">✓</div><div><a href={post.canonical_url} target="_blank" rel="noreferrer"><strong>@{post.creator_handle}</strong></a><p>Rights-confirmed {post.platform} source.</p><span>{post.likes==null?"Engagement unavailable":`${compact.format(post.likes)} platform likes`} {post.captured_at?`· snapshot ${new Date(post.captured_at).toLocaleDateString()}`:""}</span></div></article>):<p>No rights-confirmed social evidence has been approved for this product.</p>}</div>
        <label className="size-label">Choose size <select value={size} onChange={(e) => setSize(e.target.value)}>{selected.sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="checkout" onClick={addToCart} disabled={cartBusy}>{cartBusy ? "Adding…" : `Add to cart · $${selected.price}`}</button>
        {notice && <p className="notice" role="status">{notice}</p>}<small className="secure">Secure checkout powered by Stripe</small>
      </div>
    </section></div>}
    {cartOpen && <div className="cart-backdrop" onMouseDown={() => setCartOpen(false)}><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart" onMouseDown={(event) => event.stopPropagation()}>
      <div className="cart-head"><div><p className="eyebrow">Your edit</p><h2>Shopping cart</h2></div><button className="close" onClick={() => setCartOpen(false)} aria-label="Close cart">×</button></div>
      {!cartQuote ? <div className="empty-cart"><p>Your cart is waiting for something good.</p><button onClick={() => setCartOpen(false)}>Continue shopping</button></div> : <>
        <div className="cart-lines">{cartQuote.lines.map((line) => <article key={line.variantId}><div><strong>{line.productName}</strong><span>{line.variantLabel} · ${(line.unitPriceCents / 100).toFixed(2)}</span></div><div className="quantity"><button disabled={cartBusy} aria-label={`Decrease ${line.productName}`} onClick={() => updateCart(line.quantity === 1 ? cartItems.filter((item) => item.variantId !== line.variantId) : cartItems.map((item) => item.variantId === line.variantId ? { ...item, quantity: item.quantity - 1 } : item))}>−</button><span>{line.quantity}</span><button disabled={cartBusy} aria-label={`Increase ${line.productName}`} onClick={() => updateCart(cartItems.map((item) => item.variantId === line.variantId ? { ...item, quantity: item.quantity + 1 } : item))}>+</button></div><b>${(line.lineTotalCents / 100).toFixed(2)}</b></article>)}</div>
        <div className="cart-summary"><div><span>Subtotal</span><strong>${(cartQuote.subtotalCents / 100).toFixed(2)}</strong></div><p>Shipping and tax are calculated securely at checkout.</p><button className="checkout" onClick={checkout} disabled={loading}>{loading ? "Opening checkout…" : "Secure checkout"}</button></div>
      </>}{notice && <p className="notice" role="status">{notice}</p>}
    </aside></div>}
  </>;
}
