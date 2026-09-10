"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Heart, MapPin, MessageCircle, Pin, PinOff, Send, Trash2, X } from "lucide-react";
import { NumeroUnoBadge } from "@/components/community/NumeroUnoBadge";
import clsx from "clsx";
import { addComment, staffDeletePost, staffTogglePin, toggleLike } from "@/app/miembros/community-actions";
import { formatDateCL } from "@/lib/membership";
import type { FeedComment, FeedPost } from "@/lib/community";

const RARITY_LABEL: Record<string, string> = { oro: "Oro", plata: "Plata", bronce: "Bronce" };
const CHANNEL_LABEL: Record<string, string> = {
  general: "General",
  logros: "Logros",
  presentacion: "Presentación",
};

function initialsOf(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export function PostCard({ post, adminView = false, canLike = true }: { post: FeedPost; adminView?: boolean; canLike?: boolean }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [comments, setComments] = useState<FeedComment[]>(post.comments);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const like = () => {
    setLiked((v) => !v);
    setLikeCount((n) => (liked ? n - 1 : n + 1));
    startTransition(async () => {
      const result = await toggleLike(post.id);
      if (!result.ok) {
        setLiked(post.liked_by_me);
        setLikeCount(post.like_count);
      }
    });
  };

  const submitComment = () => {
    const text = draft.trim();
    if (!text) {
      setError("Escribe algo primero.");
      return;
    }
    setError(null);
    setDraft("");
    const parentId = replyTo?.id ?? null;
    setReplyTo(null);
    setComments((list) => [
      ...list,
      {
        id: `tmp-${Date.now()}`,
        post_id: post.id,
        parent_id: parentId,
        author_name: "Tú",
        author_photo: null,
        is_staff: false,
        is_mine: true,
        body: text,
        created_at: new Date().toISOString(),
      },
    ]);
    startTransition(async () => {
      const result = await addComment(post.id, text, parentId);
      if (!result.ok) setError(result.error ?? "No pudimos comentar.");
    });
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) =>
    comments.filter((c) => c.parent_id === id || (c.parent_id && c.parent_id.startsWith("tmp-") && id.startsWith("tmp-")));

  return (
    <article
      className={clsx(
        "overflow-hidden rounded-2xl border bg-[var(--scard)]",
        post.is_pinned ? "border-stride-accent/40" : "border-[var(--sline)]"
      )}
    >
      {post.is_pinned && <div className="gradient-surface h-[3px]" />}
      <div className="p-4 pb-3 sm:p-5 sm:pb-3">
        <header className="flex items-center gap-3">
          <div
            className={clsx(
              "flex h-10 w-10 flex-none items-center justify-center rounded-full font-heading text-sm font-bold text-white",
              post.is_staff
                ? "gradient-surface"
                : "border border-[var(--sline2)] bg-gradient-to-br from-stride-cyan/20 to-stride-accent/40"
            )}
          >
            {post.author_photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author_photo} alt="" className="h-full w-full rounded-full object-cover" />
            ) : post.is_staff ? (
              "S"
            ) : (
              initialsOf(post.author_name)
            )}
          </div>
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 font-heading text-sm font-bold">
              <span className="truncate">{post.is_mine ? "Tú" : post.author_name}</span>
              {post.author_badge && <NumeroUnoBadge />}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-[var(--sdim)]">
              {post.is_pinned && (
                <span className="flex items-center gap-1 font-semibold uppercase tracking-wide text-stride-accent">
                  <Pin className="h-3 w-3" /> Fijado ·
                </span>
              )}
              <span suppressHydrationWarning>{timeAgo(post.created_at)}</span> ·{" "}
              {CHANNEL_LABEL[post.channel]}
            </p>
          </div>
        </header>

        {post.title && <h3 className="mt-3 font-heading text-lg font-bold leading-snug">{post.title}</h3>}
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--smut)]">{post.body}</p>

        {post.event && (
          <div className="mt-3 rounded-xl border border-[var(--sline)] bg-[var(--scard2)] p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4 text-stride-accent" />
              {formatDateCL(post.event.event_date)}
              {post.event.event_time ? ` · ${post.event.event_time.slice(0, 5)} hrs` : ""}
            </p>
            {post.event.meeting_point && (
              <p className="mt-1.5 flex items-center gap-2 text-sm text-[var(--smut)]">
                <MapPin className="h-4 w-4 text-stride-accent" /> {post.event.meeting_point}
              </p>
            )}
            {post.event.spots_left != null && (
              <span className="mt-2.5 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500">
                Quedan {post.event.spots_left} cupos
              </span>
            )}
            {post.event.evently_url && (
              <a
                href={post.event.evently_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-3 w-full px-4 py-2.5 text-sm"
              >
                Inscribirme
              </a>
            )}
          </div>
        )}

        {post.medal && (
          <div
            className="relative mt-3 overflow-hidden rounded-xl border border-amber-500/25 p-5 text-center"
            style={{ background: "radial-gradient(120% 120% at 50% 8%, rgba(245,158,11,.12), var(--scard2) 62%)" }}
          >
            <div className="text-6xl drop-shadow-[0_8px_20px_rgba(245,158,11,.3)]">{post.medal.emoji}</div>
            <p className="mt-2 font-heading text-base font-bold text-amber-500">Medalla {post.medal.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--sdim)]">{RARITY_LABEL[post.medal.rarity] ?? post.medal.rarity}</p>
          </div>
        )}

        {post.photo_urls.length > 0 && (
          <div className={clsx("mt-3 grid gap-2", post.photo_urls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {post.photo_urls.map((url) => (
              <button key={url} type="button" onClick={() => setLightbox(url)} className="group overflow-hidden rounded-xl border border-[var(--sline)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" className="max-h-96 w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
              </button>
            ))}
          </div>
        )}

        {post.video_url && (
          <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-[var(--sline)]">
            <iframe
              src={post.video_url}
              title="Video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </div>

      <footer className="flex items-center gap-5 px-4 pb-3.5 pt-1 sm:px-5">
        <button
          type="button"
          onClick={canLike ? like : undefined}
          disabled={pending || !canLike}
          className={clsx(
            "flex items-center gap-1.5 text-sm font-semibold transition active:scale-90",
            liked ? "text-stride-accent" : "text-[var(--sdim)] hover:text-[var(--smut)]",
            !canLike && "cursor-default opacity-60"
          )}
        >
          <Heart className={clsx("h-[18px] w-[18px]", liked && "fill-current")} />
          <span className="tabular-nums">{likeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--sdim)] transition hover:text-[var(--smut)]"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="tabular-nums">{comments.length}</span>
        </button>
        {adminView && (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label={post.is_pinned ? "Desfijar" : "Fijar"}
              onClick={() =>
                startTransition(async () => {
                  await staffTogglePin(post.id);
                  router.refresh();
                })
              }
              className="rounded-full p-1.5 text-stride-accent transition hover:bg-[var(--shover)]"
            >
              {post.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label="Eliminar publicación"
              onClick={() => {
                if (!window.confirm("¿Eliminar esta publicación?")) return;
                startTransition(async () => {
                  await staffDeletePost(post.id);
                  router.refresh();
                });
              }}
              className="rounded-full p-1.5 text-red-400 transition hover:bg-[var(--shover)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </span>
        )}
        {!adminView && comments.length > 0 && !showComments && (
          <span className="ml-auto max-w-[45%] truncate text-xs text-[var(--sdim)]">
            {comments[comments.length - 1].author_name}: «{comments[comments.length - 1].body}»
          </span>
        )}
      </footer>

      {showComments && (
        <div className="space-y-3 border-t border-[var(--sline)] px-4 py-3.5 sm:px-5">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <CommentRow comment={comment} onReply={() => setReplyTo(comment)} />
              {repliesOf(comment.id).map((reply) => (
                <div key={reply.id} className="ml-9 mt-2 border-l border-[var(--sline)] pl-3">
                  <CommentRow comment={reply} onReply={() => setReplyTo(comment)} />
                </div>
              ))}
            </div>
          ))}

          {replyTo && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--ssoft)] px-3 py-1.5 text-xs">
              Respondiendo a <b>{replyTo.author_name}</b>
              <button type="button" aria-label="Cancelar respuesta" onClick={() => setReplyTo(null)} className="ml-auto text-[var(--sdim)] hover:text-[var(--stext)]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder={replyTo ? `Responde a ${replyTo.author_name}…` : "Comenta algo…"}
              className="min-w-0 flex-1 rounded-full border border-[var(--sline)] bg-[var(--scard2)] px-4 py-2 text-sm outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
            />
            <button
              type="button"
              onClick={submitComment}
              aria-label="Enviar comentario"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-stride-accent text-white transition hover:bg-stride-accentDark active:scale-90"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="m-rowin max-h-[88vh] max-w-full rounded-xl object-contain" />
        </div>
      )}
    </article>
  );
}

function CommentRow({ comment, onReply }: { comment: FeedComment; onReply: () => void }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span
        className={clsx(
          "mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white",
          comment.is_staff ? "gradient-surface" : "bg-stride-accent/30"
        )}
      >
        {comment.author_photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author_photo} alt="" className="h-full w-full rounded-full object-cover" />
        ) : comment.is_staff ? (
          "S"
        ) : (
          initialsOf(comment.author_name)
        )}
      </span>
      <div className="min-w-0">
        <p className="leading-snug">
          <span className="font-heading font-bold">{comment.is_mine ? "Tú" : comment.author_name}</span>
          {comment.author_badge && <NumeroUnoBadge className="ml-1 align-[2px]" />}{" "}
          <span className="text-[var(--smut)]">{comment.body}</span>
        </p>
        <button type="button" onClick={onReply} className="mt-0.5 text-[11px] font-semibold text-[var(--sdim)] hover:text-stride-accent">
          Responder
        </button>
      </div>
    </div>
  );
}
