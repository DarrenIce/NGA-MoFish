import * as assert from "assert";
import { Label, User } from "../../models/user";
import {
  createNgaUserMap,
  mergeNgaUserMetadata,
} from "../../process/ngaUsers";

suite("NGA user metadata", () => {
  test("merges authenticated names into a complete anonymous response", () => {
    const anonymousData: { [key: string]: any } = {};
    anonymousData["__U"] = {
      "67263109": { uid: 67263109, username: "UID:67263109" },
    };
    anonymousData["__R"] = {
      "1": { authorid: 67263109, content: "reply" },
    };
    anonymousData["__PAGE"] = 1;
    const recoveredAuthenticatedData: { [key: string]: any } = {};
    recoveredAuthenticatedData["__U"] = {
      "67263109": { uid: 67263109, username: "K记三分" },
    };

    const merged = mergeNgaUserMetadata(
      anonymousData,
      recoveredAuthenticatedData
    );

    assert.strictEqual(merged.__U["67263109"].username, "K记三分");
    assert.strictEqual(merged.__R["1"].content, "reply");
    assert.strictEqual(merged.__PAGE, 1);
  });

  test("refreshes placeholder names while preserving stored labels", () => {
    const storedUser = new User();
    storedUser.uid = "67263109";
    storedUser.userNmae = "UID:67263109";
    const label = new Label();
    label.class = "1";
    label.content = "已关注";
    storedUser.labels = [label];

    const rawUsers: { [key: string]: any } = {
      "67263109": {
        uid: 67263109,
        username: "K记三分",
        regdate: 1783339783,
      },
    };
    rawUsers["__GROUPS"] = { "39": { "0": "学徒" } };
    const users = createNgaUserMap(rawUsers, [storedUser]);

    assert.strictEqual(users.get("67263109")?.userNmae, "K记三分");
    assert.strictEqual(users.get("67263109")?.labels[0].content, "已关注");
    assert.strictEqual(users.has("__GROUPS"), false);
  });
});
