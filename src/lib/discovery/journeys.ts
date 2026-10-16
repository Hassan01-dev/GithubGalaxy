/**
 * Editorial journeys: hand-picked routes through real repositories, written by the
 * Open Source Galaxy editors. Not an algorithm, and labelled that way everywhere.
 *
 * Rules:
 * - Each repo appears in at most ONE journey. Planets are unique per galaxy (the explorer
 *   maps fullName → planet), and the galaxy loader keeps a repo only in the first region
 *   that claims it, so a shared stop would silently vanish from the later journey.
 * - fullName uses GitHub's canonical casing; every stop was checked against GitHub search.
 * - Notes are editorial and factual: why the stop belongs, never invented numbers.
 */
export interface JourneyStop {
  fullName: string;
  note: string;
}

export interface Journey {
  slug: string;
  title: string;
  description: string;
  accent?: string;
  stops: JourneyStop[];
}

export const JOURNEYS: Journey[] = [
  {
    slug: "first-discoveries",
    title: "Your first open-source discoveries",
    description: "Broad classics that show what open source can be: a kernel, a school, a list of lists, and the projects people learn from first.",
    accent: "#f5d08a",
    stops: [
      { fullName: "torvalds/linux", note: "The Linux kernel: the canonical example of a huge project built in the open by thousands of contributors. Its read-only GitHub mirror is a good first look at how it is organised." },
      { fullName: "freeCodeCamp/freeCodeCamp", note: "A free, open curriculum for learning to code. The platform itself is open source, so learners can become contributors." },
      { fullName: "sindresorhus/awesome", note: "The list that started the “awesome lists” movement: curated links on almost any topic, maintained by the community." },
      { fullName: "public-apis/public-apis", note: "A community-maintained directory of free APIs, handy when you need data for a side project." },
      { fullName: "nilbuild/developer-roadmap", note: "Visual, community-edited roadmaps for frontend, backend, DevOps and more. A map for deciding what to learn next." },
      { fullName: "jwasham/coding-interview-university", note: "One person's computer science study plan, published and refined by many others. Shows that documentation can be open source too." },
      { fullName: "ohmyzsh/ohmyzsh", note: "A framework for configuring the Zsh shell, built around community plugins and themes. Often the first open-source project people install on purpose." },
      { fullName: "d3/d3", note: "The JavaScript library behind a great many data visualisations on the web. Its examples are a lesson in what open code makes possible." },
    ],
  },
  {
    slug: "modern-web-app",
    title: "Build a modern web app",
    description: "A full stack, stop by stop: UI library, framework, styling, types, validation, database access, build tool and browser testing.",
    accent: "#7cc4ff",
    stops: [
      { fullName: "react/react", note: "The UI library at the centre of this stack. Components and hooks are the vocabulary the rest of the route builds on." },
      { fullName: "vercel/next.js", note: "A React framework for routing, server rendering and data fetching. Open Source Galaxy itself is built with it." },
      { fullName: "microsoft/TypeScript", note: "Static types for JavaScript. Catches whole classes of bugs before the code runs and powers editor tooling across the ecosystem." },
      { fullName: "tailwindlabs/tailwindcss", note: "Utility-first CSS: style directly in markup with a consistent design scale instead of writing custom stylesheets." },
      { fullName: "colinhacks/zod", note: "Schema validation with TypeScript type inference. Useful at every trust boundary, like form input and API responses." },
      { fullName: "prisma/orm", note: "A type-safe database toolkit: a schema file, migrations, and a generated client for querying Postgres, MySQL, SQLite and more." },
      { fullName: "vitejs/vite", note: "A fast dev server and build tool for frontend projects, and the foundation of many frameworks and test runners." },
      { fullName: "microsoft/playwright", note: "End-to-end testing across Chromium, Firefox and WebKit. The last stop: proving the whole app works in a real browser." },
    ],
  },
  {
    slug: "python-ecosystem",
    title: "Explore the Python ecosystem",
    description: "From the interpreter itself to web frameworks, scientific computing and the new generation of fast Python tooling.",
    accent: "#ffd43b",
    stops: [
      { fullName: "python/cpython", note: "The reference implementation of Python. Where the language, its standard library and its release process live." },
      { fullName: "django/django", note: "The “batteries included” web framework: ORM, admin, auth and templates in one coherent package." },
      { fullName: "pallets/flask", note: "A deliberately small web framework. A good contrast to Django: you choose the pieces yourself." },
      { fullName: "fastapi/fastapi", note: "A web framework built around Python type hints, which it uses for validation and automatic API documentation." },
      { fullName: "numpy/numpy", note: "N-dimensional arrays and fast numerical operations: the base layer of scientific Python." },
      { fullName: "pandas-dev/pandas", note: "DataFrames for loading, cleaning and analysing tabular data, built on top of NumPy." },
      { fullName: "astral-sh/ruff", note: "A Python linter and formatter written in Rust, designed to replace several slower tools with one fast one." },
      { fullName: "astral-sh/uv", note: "A Python package and project manager written in Rust, from the same team as Ruff. Ends the route on how Python tooling is changing." },
    ],
  },
  {
    slug: "ai-tools",
    title: "AI tools worth investigating",
    description: "The open frameworks, runtimes and interfaces behind much of today's AI work, from training to running models on your own machine.",
    accent: "#b98bff",
    stops: [
      { fullName: "pytorch/pytorch", note: "A deep learning framework used widely in research and production. Many of the models on this route were built with it." },
      { fullName: "huggingface/transformers", note: "A library for downloading, running and fine-tuning pretrained models across text, vision and audio." },
      { fullName: "ggml-org/llama.cpp", note: "LLM inference in plain C/C++, built to run models efficiently on ordinary hardware, including laptops." },
      { fullName: "ollama/ollama", note: "Download and run open models locally with one command and a simple API." },
      { fullName: "vllm-project/vllm", note: "A high-throughput inference and serving engine for LLMs, aimed at running models for many users at once." },
      { fullName: "langchain-ai/langchain", note: "A framework for composing LLM applications from models, prompts, tools and retrievers." },
      { fullName: "open-webui/open-webui", note: "A self-hosted chat interface that can sit in front of local or remote models, such as those served by Ollama." },
    ],
  },
  {
    slug: "developer-foundations",
    title: "The foundations behind developer tools",
    description: "The version control, networking, runtimes, languages and editors that much of everyday development quietly depends on.",
    accent: "#6fe0b6",
    stops: [
      { fullName: "git/git", note: "Version control for almost every project you'll visit, GitHub included. This is a mirror; patches are still reviewed on a mailing list." },
      { fullName: "curl/curl", note: "The command-line tool and libcurl library for transferring data with URLs, embedded in a vast range of software and devices." },
      { fullName: "nodejs/node", note: "The JavaScript runtime that took JavaScript outside the browser and underpins most web build tooling." },
      { fullName: "golang/go", note: "The Go language and toolchain, used for a lot of infrastructure software including container and cloud tooling." },
      { fullName: "rust-lang/rust", note: "The Rust compiler and standard library. Several tools on other routes are written in Rust for speed and memory safety." },
      { fullName: "microsoft/vscode", note: "The open-source core of Visual Studio Code, whose extension model and Language Server Protocol shaped modern editors." },
      { fullName: "neovim/neovim", note: "A modernised fork of Vim with Lua scripting and built-in LSP support. A different philosophy of editor, still thriving." },
    ],
  },
  {
    slug: "terminal-superpowers",
    title: "Terminal superpowers",
    description: "Small, sharp command-line tools that make searching, navigating and working with git noticeably faster.",
    accent: "#89e051",
    stops: [
      { fullName: "junegunn/fzf", note: "A general-purpose fuzzy finder. Pipe any list into it and pick interactively; it plugs into shell history, files and more." },
      { fullName: "BurntSushi/ripgrep", note: "Recursive search that respects .gitignore by default. Also the search engine inside VS Code." },
      { fullName: "sharkdp/fd", note: "A simpler, faster alternative to find with sensible defaults." },
      { fullName: "sharkdp/bat", note: "cat with syntax highlighting, line numbers and git change markers." },
      { fullName: "ajeetdsouza/zoxide", note: "A smarter cd that learns which directories you use and jumps to them from a few letters." },
      { fullName: "tmux/tmux", note: "A terminal multiplexer: split panes, multiple windows, and sessions that survive disconnects." },
      { fullName: "jesseduffield/lazygit", note: "A terminal UI for git that makes staging hunks, rebasing and resolving conflicts visual." },
      { fullName: "starship/starship", note: "A fast, cross-shell prompt that shows context like git status and language versions at a glance." },
    ],
  },
];

export const getJourney = (slug: string) => JOURNEYS.find((j) => j.slug === slug);

/** GitHub search ORs multiple `repo:` qualifiers together, so one call fetches a whole route. */
export const journeyQuery = (j: Journey) => j.stops.map((s) => `repo:${s.fullName}`).join(" ");
