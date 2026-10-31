import IdeaBoard from "./idea-board";

export default function Home() {
  return (
    <main className="board">
      <header className="header">
        <a className="brand" href="/" aria-label="Idea Board home"><span aria-hidden="true">✦</span> Idea Board</a>
        <span className="badge">A little idea can go a long way</span>
      </header>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">GOOD IDEAS START HERE</p>
        <h1 id="page-title">What could we<br /><span>make better?</span></h1>
        <p className="subtitle">A space for your next bright idea. Share a thought, discover fresh perspectives, and help the best ideas rise.</p>
      </section>
      <IdeaBoard />
      <footer>Made for curious minds and better possibilities.</footer>
    </main>
  );
}
