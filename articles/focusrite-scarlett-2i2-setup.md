# Focusrite Scarlett 2i2 Setup

```bash
pactl list short sources
pactl list short sinks
```

```bash
cat /proc/asound/cards
```

```bash
sudo modprobe snd_usb_audio
```

```bash
lsmod | grep snd_usb_audio
```

```bash
dmesg | tail -n20
```

```bash
lsusb | grep -i focusrite
```


```bash
sudo pacman -Syu usbutils
```

first, plug in your scarlett 2i2 usb interface. then run:

```bash
# load the usb-audio driver
sudo modprobe snd_usb_audio

# make sure you’re in the audio group so you can use the device without root
sudo usermod -aG audio $USER
```

log out and back in so the group change takes effect. since aegix uses pipewire by default, restart your pipewire services:

```bash
# under runit:
sudo sv restart pipewire
sudo sv restart pipewire-pulse
```

you can confirm the interface is seen by alsa and pipewire with:

```bash
# lists all capture/playback hw devices
arecord -l  
aplay -l  

# lists pipewire devices
pactl list short sources  
pactl list short sinks  
```

If you’re missing the alsa CLI tools. install them with:

```bash
sudo pacman -Syu alsa-utils
```

you can also peek at /proc/asound/cards if you like:

```bash
cat /proc/asound/cards
```
or with pipewire:

```bash
pactl list short sources
pactl list short sinks
```

you should see entries for “Focusrite USB” or similar. once it’s listed, open your audio app (eg. audacity or pavucontrol) and select the scarlett 2i2 as input/output. that’s it—your interface will work just like any other usb sound card.