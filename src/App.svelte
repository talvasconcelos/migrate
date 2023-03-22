<script>
  import { parse } from "papaparse";
  import { onMount } from "svelte";
  import { poolPublish } from "./lib/nostr";
  import { processSubstackData } from "./lib/process";

  let uploadedFiles, uploadedCSV;
  let posts, postsCSV, hasNIP07, loading;

  let uploadToNostr = [];
  let selectAll = false;

  $: selectAll = posts && uploadToNostr.length == posts.length;

  let platforms = [
    { value: "substack", disabled: false },
    { value: "ghost", disabled: true },
    { value: "wordpress", disabled: true }
  ];

  let selectedPlatform;

  onMount(async () => {
    await timeout(500);
    hasNIP07 = Boolean(window.nostr);
    if (!hasNIP07) return;
  });

  function reset() {
    uploadedFiles = null;
    uploadedCSV = null;
    posts = null;
    postsCSV = null;
    uploadToNostr = [];
    selectAll = false;
    loading = false;
  }

  function timeout(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function handleSelectAll() {
    // some hack to handle checked
    if (!selectAll) {
      uploadToNostr = posts;
    } else if (selectAll) {
      uploadToNostr = [];
    }
  }

  async function publish() {
    if (!hasNIP07) return;

    loading = true;
    let pubkey = await window.nostr.getPublicKey();
    let blankEv = {
      kind: 30023,
      pubkey,
      content: "",
      created_at: Math.floor(Date.now() / 1000),
      tags: []
    };
    await window.nostr.signEvent(blankEv); // Hack to prevent asking permission for every post

    uploadToNostr.forEach(async (p) => {
      let { id, title, summary, image, markdown } = p;

      const tags = [["d", id]];

      if (title && title !== "") tags.push(["title", title]);
      if (summary && summary !== "") tags.push(["summary", summary]);
      if (image && image !== "") tags.push(["image", image]);

      const event = {
        kind: 30023,
        pubkey,
        content: markdown,
        created_at: Math.floor(Date.now() / 1000),
        tags
      };

      let signed;
      try {
        signed = await window.nostr.signEvent(event);
      } catch (error) {
        loading = false;
        console.error("failed to sign with extension", error);
        return;
      }
      await poolPublish(signed);
      await timeout(500);
    });
    await timeout(1000);
    return reset();
  }

  const upload = async () => {
    // Get posts info from CSV
    let csvToJSON = new Promise(function (resolve, reject) {
      parse(uploadedCSV.item(0), {
        header: true,
        complete: function (response) {
          resolve(response.data);
        },
        error: function (err) {
          reject(err);
        }
      });
    });
    postsCSV = await Promise.resolve(csvToJSON);

    // Convert the FileList into an array and iterate
    let files = Array.from(uploadedFiles)
      .map((file) => {
        let post = postsCSV.find(
          (p) => p.post_id == file.name.replace(".html", "")
        );
        console.log(post);
        if (!post || post.is_published === "false") return;
        let output = {};
        output.id = post.post_id;
        output.title = post.title;
        output.slug = post.post_id.split(".")[1];
        output.summary = post.subtitle;
        // Define a new file reader
        let reader = new FileReader();

        // Create a new promise
        return new Promise((resolve) => {
          // Resolve the promise after reading file
          reader.onload = () => {
            output.html = reader.result;
            return resolve(output);
          };

          // Read the file as a text
          reader.readAsText(file);
        });
      })
      .filter((v) => v);

    // At this point you'll have an array of results
    let res = await Promise.all(files);

    posts = res.map(processSubstackData);
    uploadedCSV = null;
    uploadedFiles = null;
  };
</script>

<div class="header">
  <hgroup>
    <h1>Migrate to Nostr</h1>
    <h3>
      Migrate blog posts to the
      <a
        href="https://github.com/nostr-protocol/nips/blob/master/23.md"
        target="_blank"
        rel="noopener noreferrer">nip23</a
      > - article format for Nostr
    </h3>
  </hgroup>
  <p>
    <strong
      >This a WIP tool, and still under development, use at your own risk!</strong
    >
    For now it only works for Substack. You need to create an export of your Substack
    posts, extract the <code>.zip</code> file, and upload the
    <code>export/posts.csv</code>
    file and the <code>.html</code> files in <code>export/posts/</code> folder.
  </p>
  <p>
    The tool will convert the files to markdown and let you select which ones
    you want to upload to Nostr.
  </p>
  {#if !hasNIP07}
    <small
      >You need to have a signing browser extension (<a
        href="https://github.com/nostr-protocol/nips/blob/master/07.md#nip-07"
        target="_blank"
        rel="noopener noreferrer">NIP07</a
      >) to use this tool</small
    >
  {/if}
</div>
<section class="grid">
  <fieldset>
    <label for="platform">Platform</label>
    <select
      id="platform"
      bind:value={selectedPlatform}
      required
    >
      {#each platforms as platform}
        <option
          disabled={platform.disabled}
          value={platform.value}>{platform.value}</option
        >
      {/each}
      <option disabled>...more to come</option>
    </select>
  </fieldset>
</section>
{#if selectedPlatform == "substack"}
  <section class="grid">
    <label for="postscsv">
      Upload <code>posts.csv</code>
      <input
        bind:files={uploadedCSV}
        type="file"
        accept=".csv"
      />
    </label>

    <label for="posthtml">
      Upload <code>.html</code> files
      <input
        bind:files={uploadedFiles}
        type="file"
        accept=".html"
        multiple
        disabled={!uploadedCSV}
      />
    </label>
  </section>
  {#if uploadedCSV && uploadedFiles}
    <section class="action">
      <button
        style="width: auto;"
        on:click={upload}>Submit</button
      >
    </section>
  {/if}
{/if}

{#if posts}
  <section>
    <details>
      <summary>Posts</summary>
      <ul>
        <li>
          <label for="switch">
            <input
              type="checkbox"
              id="switch"
              name="switch"
              role="switch"
              on:change={handleSelectAll}
              bind:checked={selectAll}
            />
            Select all posts
          </label>
        </li>
        {#each posts as post}
          <li>
            <label for="switch">
              <input
                type="checkbox"
                id="switch"
                name="switch"
                role="switch"
                bind:group={uploadToNostr}
                value={post}
              />
              Publish - {post.title}
            </label>
          </li>
        {/each}
      </ul>
    </details>
    <details>
      <summary>Upload to Nostr</summary>
      <div>
        <!-- <fieldset>
          <label for="nsec"
            >Private Key (leave blank if you have a Nostr signing extension)</label
          >
          <input
            type="text"
            placeholder="nsec/hex"
            bind:value={sk}
          />
          <small>This is used to publish your posts, it won't be stored.</small>
        </fieldset> -->
        <button
          disabled={uploadToNostr.length < 1}
          style="width: auto; margin: 0 auto"
          aria-busy={loading}
          on:click={publish}>Button</button
        >
      </div>
    </details>
  </section>
{/if}
<footer>
  <hr />
  <div class="container-fluid">
    <p>
      <a
        href="https://github.com/talvasconcelos/migrate"
        target="_blank"
        rel="noopener noreferrer">Source code</a
      >.
    </p>
  </div>
</footer>

<style>
  .header {
    margin-bottom: 3rem;
  }
  .header h1 {
    margin: 0;
  }

  .header p {
    font-size: 0.9rem;
  }

  #plaform {
    text-transform: capitalize;
  }

  code {
    font-size: 0.75em;
  }
  .action {
    display: flex;
    justify-content: center;
    margin-top: 3rem;
  }

  ul li {
    list-style: none;
    padding: 0.75rem;
    border-bottom: 1px solid var(--muted-color);
  }
  li:last-child {
    border-bottom: none;
  }
</style>
