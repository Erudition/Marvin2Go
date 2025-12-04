First grab your `databaseUri`, `databaseUser`, and `databasePassword` [here](https://app.amazingmarvin.com/pre?api).

Then use the [couchdb API](https://docs.couchdb.org/en/stable/api/index.html) to get it done.

You'll find all your items in a single database.  All items have `_id` and `_rev` from couchdb which are used to uniquely identify items and handle conflicts (couchdb is a many-master system).

# db attribute

Each item has `db` which tells you what type of item it is.  Here is a list of all possible `db` values, along with a quick description and how stable the API is.  We try as much to be backward and forward compatible as possible since there are no database migrations.  So new fields may be added, but what's there won't change (on purpose) unless it's very necessary.

```
> grep -h 'export const' src/common/collections/* | awk '{ print $5 }' | tr -d ';'
"Categories" # Category and Project data (stable)
"DayItems" # Day notes, etc. (stable)
"Events" # Calendar events and all-day items (somewhat stable)
"Goals" # Upcoming feature (very unstable)
"Habits" # Upcoming feature (very unstable)
"PlannerItems" # time blocks (stable)
"ProfileItems" # user settings (stable)
"RecurringTasks" # (stable)
"Rewards" # Upcoming feature (very unstable)
"SavedItems" # Saved items data (stable)
"SmartLists" # Smart list data (stable)
"Sprints" # (very unstable)
"Tasks" # Task data (stable)
"TimeData" # unused legacy data
```

# Other attributes

For documentation of these item types, see [[Marvin data types]].

# Understanding conflicts

Pouchdb/couchdb has lots of advantages! But has certain disadvantages too. The fact that it's a many-master system has both advantages and disadvantages. It allows Marvin to work offline, but it also means the conflicts are very much possible. For each "document" (think task/project/savedItem/etc.), there is a tree of revisions (versions). Ideally this tree looks like:

```
v.1
 |
v.2
 |
v.3
```

But let's say that two of your devices have `v.3` of a document, and then go offline and make separate edits. Then after they sync back together, the tree will look like this:


```
     v.1
      |
     v.2
      |
     v.3
    /   \
  v.4   v.5
```

Perhaps you changed the due date on one computer and whether it's starred on another.

```
v.3: due today, not starred
v.4: due tomorrow, not starred
v.5: due today, starred
```

Since all nodes (computers) are "masters", a version is an entire copy of the document, not just a change applied to some master copy on the central server.

## How does Marvin resolve conflicts?

When Marvin finds conflicts like v.4 and v.5 above, it applies a simple conflict resolution algorithm to decide what to show within Marvin. Items in Marvin's database have a `fieldUpdates` object. This object is modified each time Marvin edits a field with the current unix timestamp (in milliseconds) when the change was made. Then all of the conflicting documents are merged together with the most recently changed field winning. In the above example Marvin would create a document that's due tomorrow and starred.

## How to avoid conflicts?

* If possible, use Marvin's public API to change documents, since it always grabs the latest version before making a change
* If you use direct database access, grab the latest version before making a change
* Avoid working in Marvin while offline or before the first sync has completed

But it could always happen, so make sure you update `fieldUpdates` if you use the direct database access! And make sure your computer's clock is correct.