import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Calendar, FileText, Newspaper } from "lucide-react";

/**
 * The article index.
 *
 * Reads trpc.blog.list, which is backed by getPublishedBlogPosts — drafts are
 * excluded in SQL, not filtered here, so nothing unpublished is ever in the
 * payload this page receives.
 *
 * The h1 and the paragraph under it are duplicated in STATIC_ROUTE_META["/blog"]
 * (server/_core/seoMeta.ts), which writes them into the served HTML for
 * crawlers. server/seoMeta.test.ts fails if the two drift apart — edit one,
 * edit the other.
 */

function formatDate(value: Date | string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Blog() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  // Same convention as /compounds?category=<slug>. seoMeta.ts canonicalises
  // every filtered URL back onto /blog, so these don't compete in the index.
  const categorySlug = params.get("category") || undefined;

  const { data: posts = [], isLoading } = trpc.blog.list.useQuery({
    categorySlug,
  });
  // Only categories with something published behind them — a filter chip that
  // leads to an empty page helps nobody.
  const { data: categories = [] } = trpc.blog.categories.useQuery();

  const activeCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <div className="flex-1 bg-[#f8f8fa] dark:bg-background">
      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 mb-8 shadow-sm dark:bg-card dark:border-border">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-[#f2ede6] dark:bg-white/10">
              <Newspaper size={24} className="text-[#d3c4ab]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-widest uppercase text-[#d3c4ab] mb-1">
                From the Lab
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight dark:text-white break-words">
                Research Blog
              </h1>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                Notes from the bench on peptide handling, documentation, and what a Certificate of
                Analysis actually tells you.
              </p>
            </div>
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link href="/blog">
              <button
                className={`text-sm font-medium px-4 py-1.5 rounded-full border transition-colors ${
                  !categorySlug
                    ? "bg-[#dbcfba] border-[#dbcfba] text-gray-900"
                    : "bg-white border-gray-200 text-gray-600 hover:border-[#dbcfba] dark:bg-card dark:border-border dark:text-gray-300"
                }`}
              >
                All articles
              </button>
            </Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/blog?category=${category.slug}`}>
                <button
                  className={`text-sm font-medium px-4 py-1.5 rounded-full border transition-colors ${
                    categorySlug === category.slug
                      ? "bg-[#dbcfba] border-[#dbcfba] text-gray-900"
                      : "bg-white border-gray-200 text-gray-600 hover:border-[#dbcfba] dark:bg-card dark:border-border dark:text-gray-300"
                  }`}
                >
                  {category.name}
                </button>
              </Link>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-72 bg-white rounded-2xl border border-gray-100 animate-pulse dark:bg-card dark:border-border"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm dark:bg-card dark:border-border">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 dark:bg-white/10">
              <FileText size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-700 mb-1 dark:text-gray-200">
              {activeCategory
                ? `Nothing published under ${activeCategory.name} yet`
                : "No articles published yet"}
            </h2>
            <p className="text-sm text-gray-400 max-w-sm mx-auto dark:text-gray-500">
              {activeCategory
                ? "Try another category, or browse everything we've published so far."
                : "We're writing. Check back soon, or browse the catalog in the meantime."}
            </p>
            <Link href={activeCategory ? "/blog" : "/compounds"}>
              <button className="mt-5 text-sm font-semibold text-[#d3c4ab] hover:underline">
                {activeCategory ? "All articles →" : "Browse the catalog →"}
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="group h-full flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer dark:bg-card dark:border-border">
                  {post.coverImageUrl ? (
                    <div className="aspect-[16/9] overflow-hidden bg-gray-50 dark:bg-white/5">
                      <img
                        src={post.coverImageUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] flex items-center justify-center bg-[#f2ede6] dark:bg-white/5">
                      <Newspaper size={28} className="text-[#d3c4ab]" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col p-5">
                    {post.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {post.categories.map((category) => (
                          <span
                            key={category.id}
                            className="text-[11px] font-semibold uppercase tracking-wide text-[#b8943a] bg-[#f2ede6] px-2 py-0.5 rounded-full dark:bg-white/10"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <h2 className="font-bold text-gray-900 text-lg leading-snug group-hover:text-[#b8943a] transition-colors dark:text-white">
                      {post.title}
                    </h2>

                    {post.excerpt && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-3 dark:text-gray-400">
                        {post.excerpt}
                      </p>
                    )}

                    {post.publishedAt && (
                      <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100 dark:text-gray-500 dark:border-border">
                        <Calendar size={12} />
                        {formatDate(post.publishedAt)}
                      </p>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
