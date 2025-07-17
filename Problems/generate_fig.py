import matplotlib.pyplot as plt
import numpy as np

# Data
styles = ["Abstract", "Cubist"]
ratings_p5 = [0.20, 0.07]
ratings_p6 = [0.44, 0.26]
ratings_p4 = [0.25, 0.35]

# Bar settings
bar_width = 0.25
x = np.arange(len(styles))

# Plot
fig, ax = plt.subplots(figsize=(6, 4))

bars_p5 = ax.bar(x - bar_width, ratings_p5, width=bar_width,
                 color="#404040", label="P5")
bars_p6 = ax.bar(x, ratings_p6, width=bar_width,
                 color="#c0c0c0", label="P6")
bars_p4 = ax.bar(x + bar_width, ratings_p4, width=bar_width,
                 color="#000000", label="P4")

# Axes styling
ax.set_ylabel("Correlation")
ax.set_xlabel("Painting style")
ax.set_title("Ratings, by Painting Style")
ax.set_xticks(x)
ax.set_xticklabels(styles)

ax.set_ylim(0, 0.5)
ax.set_yticks(np.arange(0, 0.51, 0.1))
ax.yaxis.grid(True, linestyle="--", linewidth=0.5)
ax.xaxis.grid(False)

# Legend below the plot, centered
ax.legend(loc="upper center",
          bbox_to_anchor=(0.5, -0.15),
          ncol=3,
          frameon=False)

# Clean layout
plt.tight_layout()
plt.show()

