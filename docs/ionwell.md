# Ionwell

The watch face scene is a 450-unit circle. The field stays black so always-on
pixels can turn off. Color is drawn, not baked into the background.

Time is the hour and the minute in the center, with a cyan dot and a magenta
dot between them. 12-hour mode adds the AM/PM label under the numerals. The
date sits above the time in violet.

The signature is one day arc. Midnight is the top of the ring. The arc grows
clockwise through the local civil day and carries a cyan, blue, violet, and
magenta sweep. A bright bead marks the head of the arc. Four ticks mark
midnight, 06:00, noon, and 18:00. The arc is not a goal ring and it is not a
pair of hands.

Battery is a short arc on the right, from a fixed start through a 50-degree
window. Cyan is the resting color, mint is charging, and pink is 15 percent
or below. The number is the battery percent. Weather, when the system has it,
is the current temperature, the condition name, and today's high. Unavailable
weather is `--`. A stale report keeps the numbers and adds an amber dot.

Four complication slots sit on panels along the lower edge: steps in cyan,
active minutes in violet, active calories in amber, and an open slot in
magenta. Empty data stays an accent mark. The steps slot can treat a ranged
maximum as the goal. That setting is on by default and should be turned off
for any other ranged provider. A hidden power-saving slot still publishes the
companion flag. It does not draw a visible mark.

Ring motion is on by default. The day arc, the bead, and the battery arc ease
for 0.8 seconds when their values change. Motion stays off at or below 20
percent battery, while the system low-battery flag is set, and while the
companion reports power saving. Nothing loops. The face does not read seconds.
Raising the watch fades the color scene in and the always-on scene out across
the system's ambient transition. Always-on keeps the numerals, one colon dot,
and the day bead.

The pictures in the README are a fixture at 22:10, not a capture from a watch.
