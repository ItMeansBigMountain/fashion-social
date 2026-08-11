export type SocialPost = {
  creator: string;
  handle: string;
  likes: number;
  caption: string;
  platform: "Instagram" | "TikTok";
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  imageAlt: string;
  description: string;
  sizes: string[];
  color: string;
  socialPosts: SocialPost[];
  featured?: boolean;
  variantIds?: Record<string, string>;
  sellerType?: "first_party" | "creator";
  creatorHandle?: string;
  fulfillmentModel?: "stocked" | "creator_dropship";
};

export const products: Product[] = [
  {
    id: "after-dark-blazer", name: "After Dark Blazer", brand: "Wornly Studio", category: "Jackets", price: 148,
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=88",
    imageAlt: "Model wearing a structured black blazer", description: "A clean oversized blazer with a sharp shoulder and fluid drape—built for late dinners and early meetings.",
    sizes: ["XS", "S", "M", "L", "XL"], color: "Ink black", featured: true,
    socialPosts: [
      { creator: "Maya Chen", handle: "@mayamoves", likes: 18420, caption: "The blazer that made every outfit look intentional.", platform: "Instagram" },
      { creator: "Noor Ali", handle: "@noorwears", likes: 9280, caption: "Borrowed-from-the-boys, but cut for us.", platform: "TikTok" },
      { creator: "Jules Park", handle: "@julesedited", likes: 6310, caption: "Three ways, one perfect layer.", platform: "Instagram" },
    ],
  },
  {
    id: "sienna-slip", name: "Sienna Slip", brand: "Forma", category: "Dresses", price: 118,
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=88",
    imageAlt: "Woman in a warm-toned flowing dress", description: "Bias-cut satin with an easy low back. The kind of dress that catches light and compliments.",
    sizes: ["XS", "S", "M", "L"], color: "Sienna",
    socialPosts: [
      { creator: "Amelia Rose", handle: "@ameliaafterfive", likes: 22740, caption: "Golden hour understood the assignment.", platform: "Instagram" },
      { creator: "Tess Morgan", handle: "@tessstyles", likes: 11920, caption: "Wedding guest look, solved.", platform: "TikTok" },
    ],
  },
  {
    id: "city-knit", name: "City Rib Knit", brand: "Wornly Studio", category: "Tops", price: 72,
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=88",
    imageAlt: "Street-style model wearing a fitted knit top", description: "A sculpted everyday knit with a square neckline and just enough stretch.",
    sizes: ["XS", "S", "M", "L", "XL"], color: "Oat",
    socialPosts: [
      { creator: "Rina Bell", handle: "@rinabell", likes: 14810, caption: "The top my wardrobe was missing.", platform: "Instagram" },
      { creator: "Sasha K", handle: "@sashakcloset", likes: 7600, caption: "Capsule wardrobe MVP.", platform: "TikTok" },
      { creator: "Dani Wells", handle: "@daniwearsdaily", likes: 4210, caption: "Soft, shaped, zero effort.", platform: "Instagram" },
    ],
  },
  {
    id: "gallery-coat", name: "Gallery Coat", brand: "North Line", category: "Jackets", price: 210,
    image: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1200&q=88",
    imageAlt: "Minimal fashion rack with a tailored neutral coat", description: "Longline wool-blend tailoring with concealed buttons and a dramatic, quiet silhouette.",
    sizes: ["S", "M", "L"], color: "Bone",
    socialPosts: [
      { creator: "Liv Ahn", handle: "@livinlayers", likes: 19870, caption: "Main character coat season.", platform: "Instagram" },
      { creator: "Elena Moss", handle: "@mossmode", likes: 8450, caption: "Minimal, but never boring.", platform: "Instagram" },
    ],
  },
  {
    id: "studio-scarf", name: "Studio Silk Scarf", brand: "Forma", category: "Accessories", price: 54,
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=88&crop=faces",
    imageAlt: "Editorial fashion styling with a silk accessory", description: "Hand-rolled silk in an abstract espresso print. Tie it, wrap it, make it yours.",
    sizes: ["One size"], color: "Espresso print",
    socialPosts: [
      { creator: "Cleo James", handle: "@cleocurates", likes: 12730, caption: "One scarf, five personalities.", platform: "TikTok" },
      { creator: "Mae Rivera", handle: "@maeedit", likes: 5890, caption: "The finishing touch.", platform: "Instagram" },
    ],
  },
  {
    id: "frame-dress", name: "Frame Mini Dress", brand: "North Line", category: "Dresses", price: 132,
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=88&crop=top",
    imageAlt: "Editorial model wearing a statement dress", description: "A structured mini with architectural seams and an unexpectedly comfortable fit.",
    sizes: ["XS", "S", "M", "L"], color: "Midnight",
    socialPosts: [
      { creator: "Imani Grey", handle: "@imanigrey", likes: 16550, caption: "A little dress with a big entrance.", platform: "Instagram" },
      { creator: "Zoe Hart", handle: "@zoehartstyle", likes: 9780, caption: "Date-night confidence, zipped up.", platform: "TikTok" },
    ],
  },
];

export const socialLikes = (product: Product) => product.socialPosts.reduce((sum, post) => sum + post.likes, 0);
export const heatScore = (product: Product) => Math.min(99, Math.round(62 + Math.log10(Math.max(socialLikes(product), 1)) * 7));
export const findProduct = (id: string) => products.find((product) => product.id === id);
