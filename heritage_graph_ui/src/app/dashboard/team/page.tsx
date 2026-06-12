import Image from 'next/image';

export default function OurTeam() {
  return (
    <div className="font-sans min-h-screen p-6 sm:p-12 pb-20">
      <main className="max-w-4xl mx-auto flex flex-col gap-10">
        <Image
          className="dark:invert mb-4"
          src="/cair-logo/fulllogo_nobuffer.png"
          alt="CAIR-Nepal logo"
          width={180}
          height={38}
          priority
        />

        <section className="text-sm sm:text-base leading-6">
          <h1 className="text-2xl font-bold mb-6">Our Team</h1>
          <p className="mb-8">
            CAIR-Nepal brings together a multidisciplinary team working at the
            intersection of artificial intelligence, cultural heritage, and digital
            knowledge systems. Here are the minds behind the HeritageGraph project:
          </p>

          <div className="grid sm:grid-cols-2 gap-8">
            {/* Team Member 1 */}
            <div className="flex gap-4 items-start">
              <Image
                src="/cair-logo/tekraj.jpeg"
                alt="Dr. Tek Raj Chhetri"
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold">Dr. Tek Raj Chhetri</h2>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Project Lead | Researcher in AI and Digital Heritage
                </p>
              </div>
            </div>

            {/* Team Member 2 */}
            <div className="flex gap-4 items-start">
              <Image
                src="/team/semih.jpg"
                alt="Dr. Semih Yumusak"
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold">Dr. Semih Yumusak</h2>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Advisor | Semantic Web and Knowledge Graph Expert
                </p>
              </div>
            </div>

            {/* Team Member 3 */}
            <div className="flex gap-4 items-start">
              <Image
                src="/cair-logo/nabin.jpeg"
                alt="Nabin Oli"
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold">Nabin Oli</h2>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Machine Learning Researcher | Data & Graph Modeling
                </p>
              </div>
            </div>

            {/* Team Member 4 */}
            <div className="flex gap-4 items-start">
              <Image
                src="/cair-logo/niraj.jpeg"
                alt="Niraj Karki"
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold">Niraj Karki</h2>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Software Engineer | Backend & Infrastructure
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-4 flex-col sm:flex-row mt-10">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/github.svg"
              alt="GitHub icon"
              width={20}
              height={20}
            />
            View GitHub
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://your-docs-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read Docs
          </a>
        </div>
      </main>

      <footer className="mt-20 flex gap-6 flex-wrap items-center justify-center text-sm">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="/privacy-policy"
        >
          <Image aria-hidden src="/file.svg" alt="File icon" width={16} height={16} />
          Privacy Policy
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://zenodo.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image aria-hidden src="/globe.svg" alt="Globe icon" width={16} height={16} />
          Zenodo
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://youtube.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/youtube.svg"
            alt="YouTube icon"
            width={16}
            height={16}
          />
          YouTube
        </a>
      </footer>
    </div>
  );
}
