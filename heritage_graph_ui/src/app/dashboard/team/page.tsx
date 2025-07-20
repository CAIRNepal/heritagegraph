import Image from "next/image";

export default function OurTeam() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-6 sm:p-12 pb-20">
      <main className="max-w-4xl mx-auto flex flex-col gap-10">
        <div className="flex justify-between items-center">
          <Image
            src="/cair-logo/fulllogo_nobuffer.png"
            alt="CAIR-Nepal logo"
            width={180}
            height={38}
            priority
          />
          <h1 className="text-2xl font-bold text-blue-900">Our Team</h1>
        </div>

        <section className="text-sm sm:text-base leading-6">
          <p className="mb-8 text-blue-800">
            CAIR-Nepal brings together a multidisciplinary team working at the intersection of artificial intelligence, cultural heritage, and digital knowledge systems. Here are the minds behind the HeritageGraph project:
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Team Member 1 */}
            <div className="flex gap-4 items-start bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl p-4 hover:bg-white transition-all duration-300">
              <Image
                src="/cair-logo/tekraj.jpeg"
                alt="Dr. Tek Raj Chhetri"
                width={72}
                height={72}
                className="rounded-full object-cover border-2 border-blue-300"
              />
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Dr. Tek Raj Chhetri</h2>
                <p className="text-sm text-blue-700">
                  Project Lead | Researcher in AI and Digital Heritage
                </p>
              </div>
            </div>

            {/* Team Member 2 */}
            <div className="flex gap-4 items-start bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl p-4 hover:bg-white transition-all duration-300">
              <Image
                src="/team/semih.jpg"
                alt="Dr. Semih Yumusak"
                width={72}
                height={72}
                className="rounded-full object-cover border-2 border-blue-300"
              />
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Dr. Semih Yumusak</h2>
                <p className="text-sm text-blue-700">
                  Advisor | Semantic Web and Knowledge Graph Expert
                </p>
              </div>
            </div>

            {/* Team Member 3 */}
            <div className="flex gap-4 items-start bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl p-4 hover:bg-white transition-all duration-300">
              <Image
                src="/cair-logo/nabin.jpeg"
                alt="Nabin Oli"
                width={72}
                height={72}
                className="rounded-full object-cover border-2 border-blue-300"
              />
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Nabin Oli</h2>
                <p className="text-sm text-blue-700">
                  Machine Learning Researcher | Data & Graph Modeling
                </p>
              </div>
            </div>

            {/* Team Member 4 */}
            <div className="flex gap-4 items-start bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl p-4 hover:bg-white transition-all duration-300">
              <Image
                src="/cair-logo/niraj.jpeg"
                alt="Niraj Karki"
                width={72}
                height={72}
                className="rounded-full object-cover border-2 border-blue-300"
              />
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Niraj Karki</h2>
                <p className="text-sm text-blue-700">
                  AI Researcher | Knowledge Graph Development 
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-4 flex-col sm:flex-row mt-10">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-gradient-to-r from-blue-600 to-sky-500 text-white gap-2 hover:from-blue-700 hover:to-sky-600 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto shadow-md hover:shadow-lg"
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/github.svg"
              alt="GitHub icon"
              width={20}
              height={20}
              className="invert"
            />
            View GitHub
          </a>
          <a
            className="rounded-full border border-solid border-blue-300 transition-colors flex items-center justify-center hover:bg-blue-100/50 text-blue-700 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto"
            href="https://your-docs-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read Docs
          </a>
        </div>

        <footer className="mt-20 flex gap-6 flex-wrap items-center justify-center text-sm text-blue-700">
          <a
            className="flex items-center gap-2 hover:underline hover:underline-offset-4 hover:text-blue-600"
            href="/privacy-policy"
          >
            <Image
              aria-hidden
              src="/file.svg"
              alt="File icon"
              width={16}
              height={16}
              className="opacity-70"
            />
            Privacy Policy
          </a>
          <a
            className="flex items-center gap-2 hover:underline hover:underline-offset-4 hover:text-blue-600"
            href="https://zenodo.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              aria-hidden
              src="/globe.svg"
              alt="Globe icon"
              width={16}
              height={16}
              className="opacity-70"
            />
            Zenodo
          </a>
          <a
            className="flex items-center gap-2 hover:underline hover:underline-offset-4 hover:text-blue-600"
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
              className="opacity-70"
            />
            YouTube
          </a>
          <a
            className="flex items-center gap-2 hover:underline hover:underline-offset-4 hover:text-blue-600"
            href="https://www.cair-nepal.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              aria-hidden
              src="/cair-logo/fulllogo_nobuffer.png"
              alt="CAIR-Nepal logo"
              width={16}
              height={16}
              className="opacity-70 object-contain"
            />
            CAIR-Nepal
          </a>
        </footer>
      </main>
    </div>
  );
}