# Audio source investigation

Checked 8 November 2026. Existing game audio remains Wikimedia Commons recordings;
the alternatives below have not been added to the game.

## Current downloader

The old progress log contains repeated 60-second and 600-second server cooldowns.
The client now identifies the project with a contact URL, logs the host and HTTP
status, saves separate host cooldowns and adaptive request spacing, and retries
HTTP 503 as well as 429. Valid Retry-After deadlines are honored. Spacing grows
after throttling and decreases gradually after sustained success.

A bounded live trial imported the final eight queued recordings in 26.157 seconds
with no 429 or 503 responses. This is a short observation, not a sustained
benchmark or evidence that any one change caused the improvement. Server load,
network route and elapsed cooldowns may also affect results. After synchronization,
the inventory contains 1,250 recordings and 970 words/readings; the 1,098-item
selected queue is complete.

References:

- [Wikimedia client identification](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy)
- [Wikimedia rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits)
- [Media-host throttling discussion](https://www.mediawiki.org/wiki/Talk:Wikimedia_APIs/Rate_limits)

## Lingua Libre archives and mirrors

[The dataset instructions](https://commons.wikimedia.org/wiki/Help:Lingua_Libre/Download_datasets)
link to https://lingualibre.org/datasets/. An earlier check returned HTTP 503;
the retry during this investigation timed out after 20 seconds without data.
No working Cantonese archive or verified mirror of our selected Commons files was
found. The documentation contains historical throughput claims that should not
be treated as current measurements.

## Alternatives

| Source                                                                                            | Evidence and access                                                                                                                                                                                                                                                                                                                                                                                                     | Fit for Tone Tower                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [HamBaangLaang / Global Storybooks audio](https://github.com/global-asp/hbl-audio)                | Cantonese educational stories, named readers, story/page audio, and individual source credits. The [sample story](https://global-asp.github.io/storybooks-hbl/stories/yue/00001/) credits Edwin and states CC BY 4.0. A direct GitHub audio URL returned HTTP 200 in about 0.4 seconds during this check.                                                                                                               | Strong candidate for contextual phrase/sentence practice. Longer speech needs its own content/import path and reviewed Jyutping/alignment. Keep story, author, reader and source credit; verify each item's licence. Do not treat a story's reading level as a universal word difficulty level. |
| [Cantonese Wordnet](https://github.com/lmorgadodacosta/CantoneseWN)                               | The [2025 paper](https://aclanthology.org/2025.gwc-1.29/) describes 867 professionally recorded learner-focused clips plus reviewed Commons material, with 2,138 unique pronunciations in the combined resource. It plans GitHub FLAC distribution. The currently visible master tree contains only README, attributes, TSV and XML; the only published release found is v1.0 from 2022, without attached audio assets. | Best lead for curated isolated words and a potential curated version of some of our existing material. A working audio release has not been verified. Asking the maintainers about availability would be useful; no message has been sent.                                                      |
| [Google FLEURS](https://huggingface.co/datasets/google/fleurs)                                    | Public Cantonese configuration `yue_hant_hk`; dataset card states CC BY 4.0 and provides downloadable/streamable data.                                                                                                                                                                                                                                                                                                  | Useful independent source of transcribed read sentences. Not a drop-in isolated-word collection; requires clip selection, pronunciation annotation and possibly alignment. Audio quality has not been independently auditioned here.                                                            |
| [Common Voice 27 Cantonese](https://mozilladatacollective.com/datasets/cmu5x3i5w00d6o107yvwox9lg) | The September 2026 release lists 279,396 clips, 210.78 validated hours, 1,188 speakers and a 5.99 GB archive. It labels the data CC0 but also explicitly forbids rehosting/resharing the dataset.                                                                                                                                                                                                                       | Large source of sentence recordings and validation votes. Current access terms need clarification before bundling audio in a public static game. Not selected for import.                                                                                                                       |
| [Tatoeba](https://tatoeba.org/ca/downloads)                                                       | Audio metadata includes individual recording IDs, contributors and licences. Blank licences do not permit external reuse according to its documentation. [Its FAQ](https://en.wiki.tatoeba.org/articles/show/faq) describes individual audio fetching rather than a general bulk audio archive.                                                                                                                         | Potential short utterances, subject to checking Cantonese coverage, recording licence and linguistic quality. Not a verified speed solution or mirror of Commons.                                                                                                                               |
| [WenetSpeech-Yue](https://huggingface.co/datasets/ASLP-lab/WenetSpeech-Yue)                       | Rich annotations and character timestamps; dataset card lists CC BY-NC 4.0. It directs users to original sources or to contact maintainers for preprocessed audio.                                                                                                                                                                                                                                                      | Better suited to speech research than immediate word-card expansion. Large size, source retrieval, segmentation and reuse conditions add work.                                                                                                                                                  |

## Recommended direction

Use the completed Commons collection for isolated-word practice and retain the
improved client for carefully selected expansions. Trial HamBaangLaang as a
separate contextual listening collection. Pursue the Cantonese Wordnet audio
release as the most promising curated word-level alternative. Keep FLEURS as
an independent sentence source. Do not bulk-import any source solely because
it is large or easy to download.

## Cantonese Wordnet release follow-up

Further checks on 8 November 2026:

- The upstream repository's latest commit is from 4 December 2023. Its current
  `cantown.xml` declares version 1.0 and contains no `Pronunciation` elements or
  `audio` attributes. The collaborator fork `fcbond/CantoneseWN` has the same four
  files and no audio directory.
- [Issue 4, "Release for GWC"](https://github.com/lmorgadodacosta/CantoneseWN/issues/4),
  opened by coauthor Francis Bond on 19 January 2025, is still open with no
  comments. Its unchecked tasks include linking Zenodo and preparing a packaged
  release. It contains no record identifier or download URL.
- Zenodo API searches for `CantoneseWN` and `Cantonese AND Wordnet` each returned
  zero records. This does not establish that no differently titled deposit exists.
- The README's old demo URL, https://www.luismc.com/omw/omw, returned 404 through
  the web reader. [The maintainer's current site](https://luismc.com/) still lists
  Cantonese Wordnet as active and describes audio and a CEFR-aligned graded lexicon
  as areas of work. It links back to the same GitHub repository.
- [The current Open Multilingual Wordnet browser](https://cygnet.maudslay.eu/)
  is Cygnet. Its [source manifest](https://github.com/omwn/cygnet/blob/main/wordnets.toml)
  still obtains Cantonese from the same upstream `cantown.xml`, so it does not
  provide a newer Cantonese source in that manifest. The full multilingual database
  was not downloaded: its compressed size is about 161 MB.

Conclusion: the paper documents the recordings, but a public audio release could
not be located. The open release task suggests unfinished distribution work;
that is an inference, not a confirmed explanation from the maintainers. The next
useful action for this dataset is a direct availability inquiry, rather than more
guessed download URLs.

### Prepared inquiry (not sent)

Subject: Availability of Cantonese Wordnet pronunciation recordings

Hello Luis and Joanna,

I am building Tone Tower, an open-source Cantonese tone and Jyutping practice game:
https://github.com/john0107/tone-tower

Your 2025 paper, "Can you hear me now? Towards talking Wordnets: A Cantonese Case
Study", describes reviewed Commons recordings and 867 learner-focused recordings.
I could find the text release, but not the FLAC audio or the newer metadata linking
characters, Jyutping and recordings. I also noticed the open "Release for GWC" task.

Is this material available from a public release, Zenodo deposit or another download
location? If not, would you be willing to share a research/preview release? It would
also be helpful to confirm the recording-level licences, attribution, and permission
to redistribute selected clips inside the game. We would preserve source credits and
cite your work.

Thank you for developing this resource.

### Product priorities

The longer-audio game is deferred. A future prototype could use licensed short
sentences or story pages for listening comprehension, missing-word choices or
dictation, with transcripts and reviewed pronunciation annotations. No new game,
sentence import or external contact has been started.

Near-term work should integrate sourced frequency and derived phonetic metadata
into the existing vocabulary, then review missing everyday words and pronunciation
labels. Those improvements do not depend on the Wordnet audio release.
