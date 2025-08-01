Let's say we want to create a secondary user on an [Aegix Linux](https://aegixlinux.org) system. For this example the user we created during the installation process is called `borchard` and the secondary user we want to create will be called `timothy`. 

## 1. First, check what groups "borchard" belongs to:

```bash
groups borchard
```

or

```bash
id borchard
```

## 2. Create the timothy user with home directory and zsh shell:

```bash
sudo useradd -m -s /bin/zsh timothy
```

## 3. Add timothy to the wheel group (most important for sudo access):

```bash
sudo usermod -aG wheel timothy
```

## 4. Set a password for timothy:

```bash
sudo passwd timothy
```

## 5. Copy the group memberships from borchard to timothy:

You can do this automatically with:

```bash
sudo usermod -G $(id -Gn borchard | tr ' ' ',') timothy
```

## 6. Create the essential directories that Aegix expects:

```bash
sudo -u timothy mkdir -p /home/timothy/{Downloads,Documents,Pictures,Music,Videos/obs,code,ss,Applications/vs-code-insider}
sudo -u timothy mkdir -p /home/timothy/.cache/zsh/
sudo -u timothy mkdir -p /home/timothy/.config/{abook,mpd/playlists}
sudo -u timothy mkdir -p /home/timothy/.local/src
```

## 7. Copy the Aegix dotfiles configuration:

Since Aegix uses the "gohan" dotfiles, you'll want to copy the configuration:

```bash
sudo cp -r /home/borchard/.config /home/timothy/
sudo cp -r /home/borchard/.local /home/timothy/
sudo cp /home/borchard/.* /home/timothy/ 2>/dev/null || true
sudo chown -R timothy:wheel /home/timothy
```

## 8. Set up vim/neovim plugins for timothy:

```bash
sudo -u timothy mkdir -p /home/timothy/.config/nvim/autoload
sudo -u timothy curl -Ls "https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim" > /home/timothy/.config/nvim/autoload/plug.vim
sudo -u timothy nvim -c "PlugInstall|q|q"
```

## 9. Verify the setup:

```bash
# Check groups
groups timothy

# Check home directory
ls -la /home/timothy

# Test switching to the user
su - timothy
```

The new timothy user should now have:

- A home directory with the standard Aegix directory structure
- The same group memberships as borchard (including wheel for sudo access)
- The Aegix dotfiles and configurations
- zsh as the default shell
- Neovim with plugins installed

You can now log in as timothy or switch to that user with `su - timothy`.