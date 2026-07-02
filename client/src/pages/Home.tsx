import { Link } from "wouter";
import { FlaskConical, ArrowRight, Shield, Microscope, Award } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: featured } = trpc.products.list.useQuery({ featured: true, limit: 6 });

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-accent/20 to-background py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl">
            <div className="lab-badge bg-primary/10 text-primary mb-6">
              <FlaskConical size={12} />
              Research Grade Compounds
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
              Precision Compounds for{" "}
              <span className="text-primary">Advanced Research</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              High-purity peptides and research compounds manufactured to the
              strictest laboratory standards. Trusted by researchers worldwide.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/compounds">
                <button className="lab-btn-primary">
                  Browse Compounds
                  <ArrowRight size={16} />
                </button>
              </Link>
              <Link href="/compounds">
                <button className="lab-btn-secondary">
                  View Categories
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-primary/5 pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-64 h-64 rounded-full bg-primary/3 pointer-events-none" />
      </section>

      {/* Trust badges */}
      <section className="border-y border-border bg-card">
        <div className="container py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Quality Assured", desc: "Third-party tested for purity" },
              { icon: Microscope, title: "Research Grade", desc: "Manufactured to lab standards" },
              { icon: Award, title: "Trusted Source", desc: "Used by researchers globally" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="py-16">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="lab-section-title mb-1">Browse by</p>
                <h2 className="text-2xl font-bold">Research Categories</h2>
              </div>
              <Link href="/compounds">
                <button className="lab-btn-secondary text-sm">
                  View All
                  <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.map((cat) => (
                <Link key={cat.id} href={`/compounds?category=${cat.id}`}>
                  <div className="lab-card p-4 text-center cursor-pointer hover:border-primary/30 transition-all group">
                    <div
                      className="w-3 h-3 rounded-full mx-auto mb-3"
                      style={{ backgroundColor: cat.color ?? "#6366f1" }}
                    />
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                      {cat.name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featured && featured.length > 0 && (
        <section className="py-16 bg-secondary/30">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="lab-section-title mb-1">Highlighted</p>
                <h2 className="text-2xl font-bold">Featured Compounds</h2>
              </div>
              <Link href="/compounds">
                <button className="lab-btn-secondary text-sm">
                  All Compounds
                  <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="lab-card p-10 text-center max-w-2xl mx-auto">
            <FlaskConical size={32} className="text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-3">Ready to Start Your Research?</h2>
            <p className="text-muted-foreground mb-6">
              Browse our complete catalog of research-grade compounds and peptides.
            </p>
            <Link href="/compounds">
              <button className="lab-btn-primary">
                Explore All Compounds
                <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="container">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <FlaskConical size={12} className="text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">BioLab Compounds</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              For research purposes only. Not for human consumption.
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} BioLab Compounds
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product }: { product: { id: number; name: string; slug: string; basePrice: string; shortDescription?: string | null; categoryId?: number | null } }) {
  const { data: images } = trpc.products.images.useQuery({ productId: product.id });
  const { data: variations } = trpc.products.variations.useQuery({ productId: product.id });
  const { data: categories } = trpc.categories.list.useQuery();

  const category = categories?.find((c) => c.id === product.categoryId);
  const image = images?.[0];
  const minPrice = variations && variations.length > 0
    ? Math.min(...variations.map((v) => Number(v.price)))
    : Number(product.basePrice);
  const hasVariations = variations && variations.length > 1;

  return (
    <Link href={`/compounds/${product.slug}`}>
      <div className="lab-card overflow-hidden cursor-pointer group">
        {/* Image */}
        <div className="aspect-square bg-secondary/50 overflow-hidden">
          {image ? (
            <img
              src={image.url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FlaskConical size={32} className="text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          {category && (
            <div className="flex items-center gap-1.5 mb-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: category.color ?? "#6366f1" }}
              />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {category.name}
              </span>
            </div>
          )}
          <h3 className="font-semibold text-sm leading-tight mb-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {product.shortDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {product.shortDescription}
            </p>
          )}
          {variations && variations.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {variations.slice(0, 3).map((v) => (
                <span key={v.id} className="lab-badge bg-secondary text-muted-foreground">
                  {v.value}{v.unit}
                </span>
              ))}
              {variations.length > 3 && (
                <span className="lab-badge bg-secondary text-muted-foreground">
                  +{variations.length - 3}
                </span>
              )}
            </div>
          )}
          <p className="font-semibold text-sm text-primary">
            {hasVariations ? "From " : ""}${minPrice.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
}
