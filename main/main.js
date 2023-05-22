const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

let sentThreads = [];
let sentThreads2 = [];
let idss = [];
let sentIds = [];
let k = [];
const difference = [];
const bookofids = {};

// If modifying these scopes, delete token.json.
const SCOPES = ["https://mail.google.com/"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

async function checkOldMails(auth) {
  const gmail1 = google.gmail({ version: "v1", auth });
  const inbox = await gmail1.users.labels.get({ userId: "me", id: "INBOX" });
  const messages = await gmail1.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
  });

  console.log(
    "__________________________________________________________________-"
  );
  for (const message of messages.data.messages) {
    const mid = message.id;
    const messageData = await gmail1.users.messages.get({
      userId: "me",
      id: mid,
    });
    const { threadId } = messageData.data;
    sentThreads.indexOf(threadId) === -1
      ? sentThreads.push(threadId)
      : sentThreads2.push(threadId);
    bookofids[threadId] = mid;
  }

  const difference = sentThreads.filter((d) => !sentThreads2.includes(d));
  console.log(difference);

  for (const i of difference) {
    const messageData = await gmail1.users.messages.get({
      userId: "me",
      id: i,
    });
    const { payload, threadId } = messageData.data;
    if (!payload.headers.some((header) => header.name === "In-Reply-To")) {
      const messageParts = [
        `From: enter your email address`, //enter your email address here
        `To: ${payload.headers.find((header) => header.name === "From").value}`,
        `Subject: RE: ${
          payload.headers.find((header) => header.name === "Subject").value
        }`,
        "",
        "I will be away from the office until [return date] for [reason] with no access to email. If your request is urgent, please contact [name of colleague + their job title] for assistance at [email, phone, etc.]. Otherwise, Ill get back to you as quickly as possible when I return.",
      ];

      const encodedMessage = messageParts.join("\n").trim();
      const res = await gmail1.users.messages.send({
        userId: "me",
        requestBody: {
          raw: Buffer.from(encodedMessage).toString("base64"),
          threadId: threadId,
        },
      });
      console.log("Mail Sent");
    }
  }
}

authorize().then(checkOldMails).catch(console.error);
