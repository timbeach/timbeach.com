## 🧠 How tmux Works

`tmux` is a **terminal multiplexer** — it lets you:
- Start a terminal session that **stays alive even if you disconnect** (like over SSH)
- **Split your terminal** into multiple panes and windows
- **Switch between tasks** or commands without opening new terminals
- **Reattach** to sessions later

## ⚙️ Basic Concepts

- **Session**: A named (or unnamed) workspace. Think of it like a virtual terminal container.
- **Window**: Like a tab in a terminal, inside a session.
- **Pane**: A split view within a window (horizontal/vertical).

## 🚀 Using `tmux` with Explicit Session Names

### ✅ Start a session with a name

```bash
tmux new-session -s timothason
```

This creates a new tmux session named `mysession` and attaches you to it.

---

### 🔄 Attach to a named session

```bash
tmux attach-session -t timothason 
# or tmux a -t timothason
```

### 📋 List all sessions

```bash
tmux ls
```

### 🧯 Kill a session

```bash
tmux kill-session -t mysession
```

## ⌨️ Inside tmux: Common Controls

All shortcuts use the `prefix` key, which is `Ctrl+b` by default

```bash
| Action             | Key sequence             |
| ------------------ | ------------------------ |
| New window         | `Ctrl+b`, then `c`       |
| Next window        | `Ctrl+b`, then `n`       |
| Split vertically   | `Ctrl+b`, then `"`       |
| Split horizontally | `Ctrl+b`, then `%`       |
| Move between panes | `Ctrl+b`, then arrow key |
| Detach             | `Ctrl+b`, then `d`       |
```

You can **detach** from a session and leave it running, then **reattach** later.

## ✅ Tips

- Use **one session per project** or task (e.g. `tmux new -s rails`).
- You can **script tmux** to auto-start with custom panes/windows.
- Tmux works great with **remote servers** to avoid losing work if disconnected.
