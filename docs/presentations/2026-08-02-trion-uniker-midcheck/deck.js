(() => {
  "use strict";

  const slides = Array.from(document.querySelectorAll(".slide"));
  const phaseItems = Array.from(document.querySelectorAll(".phase-item"));
  const countEl = document.querySelector(".deck-count");
  const progressEl = document.querySelector(".progress-fill");
  const prevBtn = document.querySelector("[data-action='prev']");
  const nextBtn = document.querySelector("[data-action='next']");
  const notesBtn = document.querySelector("[data-action='notes']");
  const fullscreenBtn = document.querySelector("[data-action='fullscreen']");
  const printBtn = document.querySelector("[data-action='print']");
  const notesPanel = document.querySelector(".notes-panel");
  const notesText = document.querySelector(".notes-panel p");
  const helpToast = document.querySelector(".help-toast");
  const stage = document.querySelector(".stage");
  const captureMode = new URLSearchParams(window.location.search).has("capture");
  const lightbox = document.querySelector("#mvp-image-lightbox");
  const lightboxImage = lightbox?.querySelector(".image-lightbox__image");
  const lightboxCaption = lightbox?.querySelector(".image-lightbox__caption");
  const lightboxClose = lightbox?.querySelector(".image-lightbox__close");

  let current = 0;
  let pointerStartX = 0;
  let pointerStartedOnLightboxTrigger = false;
  let toastTimer = 0;
  let controlsTimer = 0;
  let lastLightboxTrigger = null;

  const slideFromHash = () => {
    const match = window.location.hash.match(/slide-(\d+)/);
    if (!match) return 0;
    return Math.min(slides.length - 1, Math.max(0, Number(match[1]) - 1));
  };

  const fitStage = () => {
    const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    document.documentElement.style.setProperty("--deck-scale", String(scale));
  };

  const getNote = (slide) => {
    const template = slide.querySelector(".speaker-note");
    return template ? template.content.textContent.trim().replace(/\s+/g, " ") : "발표자 노트가 없습니다.";
  };

  const updatePhase = (phase) => {
    phaseItems.forEach((item, index) => {
      item.classList.toggle("active", phase > 0 && index === phase - 1);
    });
  };

  const show = (index, direction = "forward", updateHash = true) => {
    const nextIndex = Math.min(slides.length - 1, Math.max(0, index));
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === nextIndex;
      slide.classList.toggle("active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) slide.dataset.direction = direction === "back" ? "back" : "forward";
    });

    current = nextIndex;
    const activeSlide = slides[current];
    const phase = Number(activeSlide.dataset.phase || 0);
    updatePhase(phase);
    countEl.textContent = `${String(current + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    progressEl.style.width = `${((current + 1) / slides.length) * 100}%`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
    notesText.textContent = getNote(activeSlide);
    document.title = `${String(current + 1).padStart(2, "0")} · ${activeSlide.dataset.title} — 트리온 · 너의 교수님은?`;

    if (updateHash) {
      window.history.replaceState(null, "", `#slide-${current + 1}`);
    }
  };

  const next = () => show(current + 1, "forward");
  const prev = () => show(current - 1, "back");

  const toggleNotes = () => {
    document.body.classList.toggle("notes-open");
    notesBtn.setAttribute("aria-pressed", String(document.body.classList.contains("notes-open")));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      showHelp("브라우저 메뉴에서 전체 화면을 켜 주세요.");
    }
  };

  const showHelp = (message = "← → 이동 · N 발표자 노트 · F 전체 화면 · P PDF 인쇄") => {
    if (captureMode) return;
    window.clearTimeout(toastTimer);
    helpToast.textContent = message;
    helpToast.classList.add("show");
    toastTimer = window.setTimeout(() => helpToast.classList.remove("show"), 1400);
  };

  const revealControls = () => {
    if (captureMode) {
      document.body.classList.add("controls-hidden");
      return;
    }
    window.clearTimeout(controlsTimer);
    document.body.classList.remove("controls-hidden");
    controlsTimer = window.setTimeout(() => document.body.classList.add("controls-hidden"), 1500);
  };

  const isInteractiveTarget = (target) =>
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, a, input, textarea, select, [contenteditable='true'], [role='button']",
      ),
    );

  const closeLightbox = () => {
    if (lightbox?.open) lightbox.close();
  };

  const openLightbox = (trigger) => {
    if (!lightbox || !lightboxImage || !lightboxCaption || !lightboxClose) return;
    const image = trigger.querySelector("img");
    const storyStep = trigger.closest(".story-step");
    const title = storyStep?.querySelector(".story-head b")?.textContent?.trim() || "MVP 시연 이미지";
    const route = storyStep?.querySelector(".story-head small")?.textContent?.trim() || "";
    if (!image) return;

    lastLightboxTrigger = trigger;
    lightboxImage.src = image.currentSrc || image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = route ? `${title} · ${route}` : title;
    lightbox.showModal();
    document.body.classList.add("lightbox-open");
    window.requestAnimationFrame(() => lightboxClose.focus());
  };

  const initializeLightbox = () => {
    if (captureMode || !lightbox || typeof lightbox.showModal !== "function") return;

    const triggers = Array.from(document.querySelectorAll(".storyboard-slide .story-shot"));
    triggers.forEach((trigger) => {
      const storyStep = trigger.closest(".story-step");
      const title = storyStep?.querySelector(".story-head b")?.textContent?.trim() || "MVP 시연 이미지";
      const route = storyStep?.querySelector(".story-head small")?.textContent?.trim() || "";
      trigger.dataset.lightboxTrigger = "";
      trigger.tabIndex = 0;
      trigger.setAttribute("role", "button");
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", lightbox.id);
      trigger.setAttribute("aria-label", `이미지 확대: ${title}${route ? ` (${route})` : ""}`);
      trigger.addEventListener("click", () => openLightbox(trigger));
      trigger.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        openLightbox(trigger);
      });
    });

    lightboxClose?.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    lightbox.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeLightbox();
    });
    lightbox.addEventListener("close", () => {
      document.body.classList.remove("lightbox-open");
      if (lastLightboxTrigger instanceof HTMLElement) lastLightboxTrigger.focus();
      lastLightboxTrigger = null;
    });
  };

  document.addEventListener("keydown", (event) => {
    if (lightbox?.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      }
      return;
    }
    revealControls();
    if (isInteractiveTarget(event.target)) return;

    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      next();
    } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      prev();
    } else if (event.key === "Home") {
      event.preventDefault();
      show(0, "back");
    } else if (event.key === "End") {
      event.preventDefault();
      show(slides.length - 1, "forward");
    } else if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      toggleNotes();
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      window.print();
    } else if (event.key === "?") {
      event.preventDefault();
      showHelp();
    }
  });

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  notesBtn.addEventListener("click", toggleNotes);
  fullscreenBtn.addEventListener("click", toggleFullscreen);
  printBtn.addEventListener("click", () => window.print());
  document.addEventListener("pointermove", revealControls, { passive: true });

  stage.addEventListener("pointerdown", (event) => {
    pointerStartedOnLightboxTrigger =
      event.target instanceof Element && Boolean(event.target.closest("[data-lightbox-trigger]"));
    pointerStartX = event.clientX;
  });

  stage.addEventListener("pointerup", (event) => {
    if (pointerStartedOnLightboxTrigger) {
      pointerStartedOnLightboxTrigger = false;
      return;
    }
    const distance = event.clientX - pointerStartX;
    if (Math.abs(distance) < 80) return;
    if (distance < 0) next();
    else prev();
  });

  window.addEventListener("resize", fitStage);
  window.addEventListener("hashchange", () => show(slideFromHash(), "forward", false));
  document.addEventListener("fullscreenchange", fitStage);
  window.addEventListener("beforeprint", closeLightbox);

  if (captureMode) document.body.classList.add("capture-mode", "controls-hidden");
  initializeLightbox();
  fitStage();
  show(slideFromHash(), "forward", false);
  revealControls();
  window.setTimeout(() => showHelp(), 450);

  window.presentationDeck = {
    next,
    prev,
    goTo: (slideNumber) => show(Number(slideNumber) - 1),
    toggleNotes,
  };
})();
