import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Calendar, Clock, Newspaper } from "lucide-react";
import BlogContent from "@/components/BlogContent";
import { blogReadingMinutes, parseBlogDoc } from "@shared/blog";

/**
 * One article.
 *
 * trpc.blog.bySlug returns undefined for a draft exactly as it does for a slug
 * that was never used, so an unpublished post renders the not-found state even
 * to somebody who knows the URL. seoMeta.ts marks the same URL noindex.
 *
 * The h1 here is the post title, which is also what the server writes into the
 * #root placeholder — one h1 in the document either way, which is why
 * BlogContent clamps body headings to h2/h3.
 */

function formatDate(value: Date | string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";

  const { data: post, isLoading } = trpc.blog.bySlug.useQuery({ slug }, { enabled: slug !== "" });

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#f8f8fa] dark:bg-background">
        <main className="max-w-3xl mx-auto px-4 py-12">
          <div className="h-8 w-2/3 bg-white rounded-lg animate-pulse mb-4 dark:bg-card" />
          <div className="h-64 bg-white rounded-2xl animate-pulse dark:bg-card" />
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex-1 bg-[#f8f8fa] dark:bg-background">
        <main className="max-w-3xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 dark:bg-card">
            <Newspaper size={28} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2 dark:text-white">
            Article not found
          </h1>
          <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
            This article may have been moved or is no longer published.
          </p>
          <Link href="/blog">
            <button className="lab-btn-primary">Back to the blog</button>
          </Link>
        </main>
      </div>
    );
  }

  const readingMinutes = blogReadingMinutes(parseBlogDoc(post.content));

  return (
    <div className="flex-1 bg-[#f8f8fa] dark:bg-background">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/blog">
          <button className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors dark:text-gray-400 dark:hover:text-white">
            <ArrowLeft size={15} />
            All articles
          </button>
        </Link>

        <article className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm dark:bg-card dark:border-border">
          {post.coverImageUrl && (
            <div className="aspect-[16/9] overflow-hidden bg-gray-50 dark:bg-white/5">
              <img src={post.coverImageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6 sm:p-10">
            {post.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {post.categories.map((category) => (
                  <Link key={category.id} href={`/blog?category=${category.slug}`}>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#b8943a] bg-[#f2ede6] px-2 py-0.5 rounded-full cursor-pointer hover:bg-[#e8dcc8] dark:bg-white/10">
                      {category.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight dark:text-white">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-base text-gray-500 mt-3 leading-relaxed dark:text-gray-400">
                {post.excerpt}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 pb-6 mb-8 border-b border-gray-100 text-xs text-gray-400 dark:border-border dark:text-gray-500">
              {post.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {formatDate(post.publishedAt)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                {readingMinutes} min read
              </span>
              {post.authorName && <span>By {post.authorName}</span>}
            </div>

            <BlogContent content={post.content} className="text-[15px]" />
          </div>
        </article>
      </main>
    </div>
  );
}
